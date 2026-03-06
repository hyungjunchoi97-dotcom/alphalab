import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface FredObs {
  date: string;
  value: string;
}

interface DataPoint {
  date: string;
  usdkrw: number;
  spread: number;
  vix: number;
}

interface ModelResult {
  actual: { date: string; value: number }[];
  predicted: { date: string; value: number }[];
  forwardProjection: { date: string; high: number; low: number; mid: number }[];
  currentPredicted: number;
  currentActual: number;
  confidenceHigh: number;
  confidenceLow: number;
  r2: number;
  coefficients: { intercept: number; spread: number; vix: number };
  signals: {
    spread: number;
    spreadDirection: string;
    vix: number;
    vixSignal: string;
  };
}

interface CacheEntry {
  data: ModelResult;
  cachedAt: number;
}

const FRED_API_KEY = process.env.FRED_API_KEY;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache: CacheEntry | null = null;

async function fetchFredSeries(seriesId: string): Promise<FredObs[]> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=800`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.observations || []).filter((o: FredObs) => o.value !== ".");
}

function linearRegression(X: number[][], y: number[]): { coefficients: number[]; r2: number } {
  const n = y.length;
  if (n < 5) return { coefficients: [0, 0, 0], r2: 0 };

  // X has columns: [1, spread, vix] for each row
  // Simple OLS: (X'X)^-1 X'y for 3 params
  const k = X[0].length;

  // X'X
  const XtX: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  const Xty: number[] = Array(k).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let l = 0; l < k; l++) {
        XtX[j][l] += X[i][j] * X[i][l];
      }
    }
  }

  // Solve 3x3 system using Cramer's rule
  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const D = det3(XtX);
  if (Math.abs(D) < 1e-10) return { coefficients: [0, 0, 0], r2: 0 };

  const coefficients: number[] = [];
  for (let c = 0; c < k; c++) {
    const M = XtX.map((row, r) => row.map((v, col) => (col === c ? Xty[r] : v)));
    coefficients.push(det3(M) / D);
  }

  // R²
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = X[i].reduce((s, x, j) => s + x * coefficients[j], 0);
    ssRes += (y[i] - yPred) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { coefficients, r2 };
}

export async function GET() {
  if (!FRED_API_KEY) {
    return NextResponse.json({ ok: false, error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, model: cache.data });
  }

  try {
    const [fxObs, fedObs, vixObs, kr10yObs] = await Promise.all([
      fetchFredSeries("DEXKOUS"),
      fetchFredSeries("FEDFUNDS"),
      fetchFredSeries("VIXCLS"),
      fetchFredSeries("IRLTLT01KRM156N"),
    ]);

    // Parse and index by date
    const fxMap = new Map(fxObs.map(o => [o.date, parseFloat(o.value)]));
    const fedMap = new Map(fedObs.map(o => [o.date.slice(0, 7), parseFloat(o.value)]));
    const vixMap = new Map(vixObs.map(o => [o.date, parseFloat(o.value)]));
    const kr10yMap = new Map(kr10yObs.map(o => [o.date.slice(0, 7), parseFloat(o.value)]));

    // Build aligned monthly data for last 3 years
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 3);
    const cutStr = cutoff.toISOString().slice(0, 10);

    // Get monthly FX data points
    const fxDates = fxObs
      .map(o => o.date)
      .filter(d => d >= cutStr)
      .reverse();

    // Group by month, take last observation of each month
    const monthlyFx = new Map<string, { date: string; value: number }>();
    for (const d of fxDates) {
      const m = d.slice(0, 7);
      const v = fxMap.get(d);
      if (v && !isNaN(v)) monthlyFx.set(m, { date: d, value: v });
    }

    const dataPoints: DataPoint[] = [];
    for (const [month, fx] of monthlyFx) {
      const fed = fedMap.get(month);
      const kr = kr10yMap.get(month);
      const vix = vixMap.get(fx.date);
      if (fed !== undefined && kr !== undefined && vix !== undefined && !isNaN(fed) && !isNaN(kr) && !isNaN(vix)) {
        dataPoints.push({
          date: fx.date,
          usdkrw: fx.value,
          spread: fed - kr,
          vix: vix,
        });
      }
    }

    dataPoints.sort((a, b) => a.date.localeCompare(b.date));

    if (dataPoints.length < 10) {
      return NextResponse.json({ ok: false, error: "Insufficient data for regression" }, { status: 500 });
    }

    // Build regression
    const X = dataPoints.map(d => [1, d.spread, d.vix]);
    const y = dataPoints.map(d => d.usdkrw);
    const { coefficients, r2 } = linearRegression(X, y);

    const [intercept, spreadCoef, vixCoef] = coefficients;

    // Generate predicted values
    const actual = dataPoints.map(d => ({ date: d.date, value: d.usdkrw }));
    const predicted = dataPoints.map(d => ({
      date: d.date,
      value: Math.round(intercept + spreadCoef * d.spread + vixCoef * d.vix),
    }));

    // Current values
    const latest = dataPoints[dataPoints.length - 1];
    const currentPredicted = Math.round(intercept + spreadCoef * latest.spread + vixCoef * latest.vix);
    const currentActual = latest.usdkrw;

    // Residual std for confidence interval
    const residuals = dataPoints.map((d, i) => d.usdkrw - predicted[i].value);
    const residualStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);

    // 1M forward projection (3 scenarios: spread +-0.25, vix +-3)
    const projections: { date: string; high: number; low: number; mid: number }[] = [];
    const today = new Date();
    for (let w = 1; w <= 4; w++) {
      const d = new Date(today);
      d.setDate(d.getDate() + w * 7);
      const dateStr = d.toISOString().slice(0, 10);
      const mid = currentPredicted;
      projections.push({
        date: dateStr,
        mid,
        high: Math.round(mid + 1.5 * residualStd),
        low: Math.round(mid - 1.5 * residualStd),
      });
    }

    const result: ModelResult = {
      actual,
      predicted,
      forwardProjection: projections,
      currentPredicted,
      currentActual,
      confidenceHigh: Math.round(currentPredicted + 1.5 * residualStd),
      confidenceLow: Math.round(currentPredicted - 1.5 * residualStd),
      r2: parseFloat(r2.toFixed(4)),
      coefficients: { intercept: parseFloat(intercept.toFixed(2)), spread: parseFloat(spreadCoef.toFixed(2)), vix: parseFloat(vixCoef.toFixed(2)) },
      signals: {
        spread: parseFloat(latest.spread.toFixed(2)),
        spreadDirection: latest.spread > 0 ? "원화약세" : "원화강세",
        vix: parseFloat(latest.vix.toFixed(1)),
        vixSignal: latest.vix > 20 ? "달러강세" : "달러약세",
      },
    };

    cache = { data: result, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, model: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
