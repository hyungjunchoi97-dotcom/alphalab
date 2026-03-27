import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic();
const FRED_API_KEY = process.env.FRED_API_KEY;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────
interface TimePoint { date: string; value: number }

interface CorrelationResult {
  walcl:    { sp500: number; gold: number; bonds: number; btc: number };
  rrp:      { sp500: number; gold: number; bonds: number; btc: number };
  tga:      { sp500: number; gold: number; bonds: number; btc: number };
  reserves: { sp500: number; gold: number; bonds: number; btc: number };
}

interface SimilarPeriod {
  label: string;
  labelKr: string;
  similarity: number;
  pattern: { walcl: string; rrp: string; tga: string; reserves: string };
  outcomes: { sp500: number; gold: number; bonds: number; btc: number };
  note: string;
}

interface AlphaSignal {
  overall_regime: string;
  stocks_signal: "ADD" | "HOLD" | "REDUCE";
  gold_signal: "ADD" | "HOLD" | "REDUCE";
  bonds_signal: "ADD" | "HOLD" | "REDUCE";
  cash_signal: "ADD" | "HOLD" | "REDUCE";
  bitcoin_signal: "ADD" | "HOLD" | "REDUCE";
  key_trigger: string;
  action_items: string[];
  watch_for: string;
  confidence: number;
}

// ── FRED fetch ─────────────────────────────────────────────
interface FredObs { date: string; value: string }

async function fetchFredSeries(seriesId: string, limit = 200): Promise<TimePoint[]> {
  if (!FRED_API_KEY) return [];
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const json = await res.json();
    const obs: FredObs[] = (json.observations || []).filter((o: FredObs) => o.value !== ".");
    return obs
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
      .filter((o) => !isNaN(o.value))
      .reverse(); // oldest first
  } catch {
    return [];
  }
}

// ── Yahoo Finance fetch ────────────────────────────────────
async function fetchYahoo(symbol: string): Promise<TimePoint[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1wk&range=2y&events=history`;
    console.log(`[Correlation] Fetching Yahoo ${symbol}...`);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[Correlation] Yahoo ${symbol} HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) {
      console.error(`[Correlation] Yahoo ${symbol} no result`);
      return [];
    }

    const timestamps: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const data: TimePoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null || isNaN(close)) continue;
      const d = new Date(timestamps[i] * 1000);
      data.push({ date: d.toISOString().slice(0, 10), value: Math.round(close * 100) / 100 });
    }
    console.log(`[Correlation] Yahoo ${symbol} = ${data.length} points`);
    return data;
  } catch (e) {
    console.error(`[Correlation] Yahoo ${symbol} failed:`, e);
    return [];
  }
}

// ── ISO week key for date alignment ─────────────────────────
function isoWeekKey(dateStr: string): string {
  // Convert date to YYYY-WNN format so FRED (Wed) and Yahoo (Mon) align
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay();
  // Shift to Thursday of the same ISO week
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + (4 - (dayOfWeek || 7)));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ── Pearson correlation (aligned by ISO week) ────────────────
function pearson(a: TimePoint[], b: TimePoint[]): number {
  // Build week-aligned maps
  const aMap = new Map<string, number>();
  for (const p of a) aMap.set(isoWeekKey(p.date), p.value);
  const bMap = new Map<string, number>();
  for (const p of b) bMap.set(isoWeekKey(p.date), p.value);

  // Find overlapping weeks and compute % changes
  const weeks = [...aMap.keys()].filter((w) => bMap.has(w)).sort();
  if (weeks.length < 10) return 0;

  // Use % change from first overlapping week
  const aBase = aMap.get(weeks[0])!;
  const bBase = bMap.get(weeks[0])!;
  if (aBase === 0 || bBase === 0) return 0;

  const x = weeks.map((w) => (aMap.get(w)! / aBase - 1) * 100);
  const y = weeks.map((w) => (bMap.get(w)! / bBase - 1) * 100);

  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  const num = x.reduce((s, xi, i) => s + (xi - meanX) * (y[i] - meanY), 0);
  const den = Math.sqrt(
    x.reduce((s, xi) => s + (xi - meanX) ** 2, 0) *
    y.reduce((s, yi) => s + (yi - meanY) ** 2, 0)
  );
  if (den === 0) return 0;
  return Math.round((num / den) * 100) / 100;
}

// ── Normalize to % change from start ──────────────────────
function normalize(data: TimePoint[]): TimePoint[] {
  if (data.length === 0) return [];
  const base = data[0].value;
  if (base === 0) return data;
  return data.map((p) => ({ date: p.date, value: Math.round(((p.value / base - 1) * 100) * 100) / 100 }));
}

// ── Resample to weekly (by ISO week) for chart alignment ──
function resampleWeekly(data: TimePoint[]): TimePoint[] {
  const weekMap = new Map<string, TimePoint>();
  for (const p of data) {
    const wk = isoWeekKey(p.date);
    weekMap.set(wk, p); // last value wins per week
  }
  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, p]) => p);
}

// ── Historical similar periods (hardcoded known periods) ──
const HISTORICAL_PERIODS: SimilarPeriod[] = [
  {
    label: "2022-03 ~ 2022-08",
    labelKr: "2022년 3월 ~ 8월",
    similarity: 0,
    pattern: { walcl: "down", rrp: "up", tga: "down", reserves: "down" },
    outcomes: { sp500: -18.2, gold: -11.4, bonds: -22.1, btc: -65.3 },
    note: "QT 개시 + 급격한 금리인상 → 전 자산 동반 하락",
  },
  {
    label: "2019-09 ~ 2019-12",
    labelKr: "2019년 9월 ~ 12월",
    similarity: 0,
    pattern: { walcl: "up", rrp: "down", tga: "flat", reserves: "up" },
    outcomes: { sp500: 12.1, gold: 8.3, bonds: 3.2, btc: 87.0 },
    note: "레포 위기 후 연준 개입 → 유동성 공급 재개 반등",
  },
  {
    label: "2020-03 ~ 2020-06",
    labelKr: "2020년 3월 ~ 6월",
    similarity: 0,
    pattern: { walcl: "up", rrp: "down", tga: "up", reserves: "up" },
    outcomes: { sp500: 20.0, gold: 14.0, bonds: 5.0, btc: 60.0 },
    note: "무제한 QE 개시 → 유동성 폭발적 공급 → 전 자산 급등",
  },
  {
    label: "2018-10 ~ 2019-01",
    labelKr: "2018년 10월 ~ 2019년 1월",
    similarity: 0,
    pattern: { walcl: "down", rrp: "flat", tga: "up", reserves: "down" },
    outcomes: { sp500: -14.0, gold: 4.0, bonds: 3.0, btc: -50.0 },
    note: "QT + 무역전쟁 → 위험자산 조정, 안전자산 강세",
  },
];

function findSimilarPeriods(currentPattern: { walcl: string; rrp: string; tga: string; reserves: string }): SimilarPeriod[] {
  const keys = ["walcl", "rrp", "tga", "reserves"] as const;
  return HISTORICAL_PERIODS
    .map((p) => {
      let match = 0;
      for (const k of keys) {
        if (p.pattern[k] === currentPattern[k]) match += 25;
        else if (p.pattern[k] === "flat" || currentPattern[k] === "flat") match += 10;
      }
      return { ...p, similarity: match };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 2);
}

// ── Strip citations ────────────────────────────────────────
function stripCitations(text: string): string {
  return text.replace(/<\/?cite[^>]*>/g, "");
}

// ── Main handler ───────────────────────────────────────────
export async function GET() {
  try {
    // 1. Check cache
    const cacheKey = "liquidity_correlation_v1";
    try {
      const { data: cached } = await supabaseAdmin
        .from("liquidity_correlation_cache")
        .select("*")
        .eq("cache_key", cacheKey)
        .maybeSingle();

      if (cached && Date.now() - new Date(cached.updated_at).getTime() < ONE_HOUR) {
        return NextResponse.json({ ok: true, ...cached.data, cached: true });
      }
    } catch { /* table may not exist */ }

    // 2. Fetch all data in parallel
    const [walclData, rrpData, tgaData, resData, sp500Data, goldData, bondsData, btcData] = await Promise.all([
      fetchFredSeries("WALCL", 200),
      fetchFredSeries("RRPONTSYD", 600),   // daily, need more
      fetchFredSeries("WTREGEN", 200),
      fetchFredSeries("WRESBAL", 200),
      fetchYahoo("%5EGSPC"),
      fetchYahoo("GC%3DF"),
      fetchYahoo("%5ETNX"),
      fetchYahoo("BTC-USD"),
    ]);

    console.log(`[Correlation] Data lengths: WALCL=${walclData.length} RRP=${rrpData.length} TGA=${tgaData.length} RES=${resData.length} SP500=${sp500Data.length} Gold=${goldData.length} Bonds=${bondsData.length} BTC=${btcData.length}`);

    // 3. Calculate correlations
    const correlations: CorrelationResult = {
      walcl:    { sp500: pearson(walclData, sp500Data), gold: pearson(walclData, goldData), bonds: pearson(walclData, bondsData), btc: pearson(walclData, btcData) },
      rrp:      { sp500: pearson(rrpData, sp500Data),   gold: pearson(rrpData, goldData),   bonds: pearson(rrpData, bondsData),   btc: pearson(rrpData, btcData) },
      tga:      { sp500: pearson(tgaData, sp500Data),   gold: pearson(tgaData, goldData),   bonds: pearson(tgaData, bondsData),   btc: pearson(tgaData, btcData) },
      reserves: { sp500: pearson(resData, sp500Data),   gold: pearson(resData, goldData),   bonds: pearson(resData, bondsData),   btc: pearson(resData, btcData) },
    };

    // 4. Normalized + resampled weekly series for charts
    const liquidity = {
      walcl: normalize(resampleWeekly(walclData)),
      rrp: normalize(resampleWeekly(rrpData)),
      tga: normalize(resampleWeekly(tgaData)),
      reserves: normalize(resampleWeekly(resData)),
    };
    const markets = {
      sp500: normalize(resampleWeekly(sp500Data)),
      gold: normalize(resampleWeekly(goldData)),
      bonds: normalize(resampleWeekly(bondsData)),
      btc: normalize(resampleWeekly(btcData)),
    };

    // 5. Current pattern for similarity
    const trend = (data: TimePoint[]) => {
      if (data.length < 2) return "flat";
      const recent = data[data.length - 1].value;
      const prev = data[Math.max(0, data.length - 5)].value;
      if (recent > prev * 1.005) return "up";
      if (recent < prev * 0.995) return "down";
      return "flat";
    };

    const currentPattern = {
      walcl: trend(walclData),
      rrp: trend(rrpData),
      tga: trend(tgaData),
      reserves: trend(resData),
    };
    const similarPeriods = findSimilarPeriods(currentPattern);

    // 6. Alpha signal (cached daily)
    let alphaSignal: AlphaSignal | null = null;
    const alphaCacheKey = "alpha_signal_v1";

    try {
      const { data: cached } = await supabaseAdmin
        .from("alpha_signal_cache")
        .select("*")
        .eq("cache_key", alphaCacheKey)
        .maybeSingle();

      if (cached && Date.now() - new Date(cached.updated_at).getTime() < ONE_DAY) {
        alphaSignal = cached.signal;
      }
    } catch { /* ok */ }

    if (!alphaSignal) {
      try {
        const latest = (d: TimePoint[]) => d.length > 0 ? d[d.length - 1].value : 0;
        const bestPeriod = similarPeriods[0];

        const prompt = `You are a global macro strategist using Fed liquidity framework.
Analyze: Fed Balance Sheet, RRP, TGA, Bank Reserves trends.
Cross-reference with historical correlations to S&P500, Gold, Bonds, BTC.
Output JSON only, no markdown code blocks.

Current liquidity data:
- Fed B/S: ${Math.round(latest(walclData))}M trend:${currentPattern.walcl}
- RRP: ${Math.round(latest(rrpData))}B trend:${currentPattern.rrp}
- TGA: ${Math.round(latest(tgaData))}M trend:${currentPattern.tga}
- Bank Reserves: ${Math.round(latest(resData))}M trend:${currentPattern.reserves}

Correlations (Fed B/S vs markets):
- S&P500: r=${correlations.walcl.sp500}, Gold: r=${correlations.walcl.gold}, Bonds: r=${correlations.walcl.bonds}, BTC: r=${correlations.walcl.btc}

Most similar historical period: ${bestPeriod.label} (similarity: ${bestPeriod.similarity}%)
That period outcome: S&P500 ${bestPeriod.outcomes.sp500}%, Gold ${bestPeriod.outcomes.gold}%, Bonds ${bestPeriod.outcomes.bonds}%, BTC ${bestPeriod.outcomes.btc}%

Respond JSON:
{
  "overall_regime": "string describing current regime in Korean",
  "stocks_signal": "ADD"|"HOLD"|"REDUCE",
  "gold_signal": "ADD"|"HOLD"|"REDUCE",
  "bonds_signal": "ADD"|"HOLD"|"REDUCE",
  "cash_signal": "ADD"|"HOLD"|"REDUCE",
  "bitcoin_signal": "ADD"|"HOLD"|"REDUCE",
  "key_trigger": "Korean, 1 sentence, most critical thing happening now",
  "action_items": ["3 items in Korean, specific and actionable"],
  "watch_for": "Korean, next key event to monitor",
  "confidence": number 0-100
}`;

        const res = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        });

        let text = "";
        for (const block of res.content) {
          if (block.type === "text") text += block.text;
        }
        text = stripCitations(text.replace(/```json|```/g, "").trim());
        alphaSignal = JSON.parse(text);

        try {
          await supabaseAdmin.from("alpha_signal_cache").upsert({
            cache_key: alphaCacheKey,
            signal: alphaSignal,
            updated_at: new Date().toISOString(),
          }, { onConflict: "cache_key" });
        } catch { /* ok */ }
      } catch (e) {
        console.error("[Correlation] Alpha signal failed:", e);
      }
    }

    // 7. Build response
    const responseData = {
      liquidity,
      markets,
      correlations,
      currentPattern,
      similarPeriods,
      alphaSignal,
    };

    // Cache
    try {
      await supabaseAdmin.from("liquidity_correlation_cache").upsert({
        cache_key: cacheKey,
        data: responseData,
        updated_at: new Date().toISOString(),
      }, { onConflict: "cache_key" });
    } catch { /* ok */ }

    return NextResponse.json({ ok: true, ...responseData, cached: false }, {
      headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (err) {
    console.error("[Correlation] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
