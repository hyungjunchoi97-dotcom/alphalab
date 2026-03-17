import { NextResponse } from "next/server";

const CACHE_TTL = 60 * 60 * 1000; // 1시간
let memCache: { data: object; cachedAt: number } | null = null;

function getRecentTradingDays(count: number): string[] {
  const days: string[] = [];
  const d = new Date();
  while (days.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push(`${y}${m}${dd}`);
    }
    d.setDate(d.getDate() - 1);
  }
  return days;
}

export async function GET() {
  if (memCache && Date.now() - memCache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, ...memCache.data, cached: true });
  }

  try {
    const tradingDays = getRecentTradingDays(60);
    const endDd = tradingDays[0];
    const strtDd = tradingDays[tradingDays.length - 1];

    // KRX 투자자별 매매동향 (KOSPI)
    const res = await fetch("https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://data.krx.co.kr/contents/MDC/MDI/mdiBatchList/MDIBTS007.cmd",
        "Origin": "https://data.krx.co.kr",
      },
      body: new URLSearchParams({
        bld: "dbms/MDC/STAT/standard/MDCSTAT02203",
        locale: "ko_KR",
        mktId: "STK",
        invstTpCd: "9999",
        strtDd,
        endDd,
        csvxls_isNo: "false",
      }).toString(),
    });

    if (!res.ok) throw new Error(`KRX HTTP ${res.status}`);
    const json = await res.json();
    const rows = json.output || [];

    // 날짜별 외국인/기관/개인 순매수 파싱
    const series = rows.map((r: Record<string, string>) => ({
      date: `${r.TRD_DD?.slice(0, 4)}-${r.TRD_DD?.slice(4, 6)}-${r.TRD_DD?.slice(6, 8)}`,
      foreign: Number(r.FRNG_NETBID_TRDVOL?.replace(/,/g, "") || 0),      // 외국인 순매수(주)
      institution: Number(r.ORGN_NETBID_TRDVOL?.replace(/,/g, "") || 0),  // 기관 순매수(주)
      individual: Number(r.INDV_NETBID_TRDVOL?.replace(/,/g, "") || 0),   // 개인 순매수(주)
      foreignAmt: Number(r.FRNG_NETBID_TRDVAL?.replace(/,/g, "") || 0),   // 외국인 순매수(금액)
      institutionAmt: Number(r.ORGN_NETBID_TRDVAL?.replace(/,/g, "") || 0),
      individualAmt: Number(r.INDV_NETBID_TRDVAL?.replace(/,/g, "") || 0),
    })).reverse(); // 오래된 순으로

    // 최근 누적 순매수
    const recent20 = series.slice(-20);
    const foreignNet20 = recent20.reduce((s: number, r: { foreignAmt: number }) => s + r.foreignAmt, 0);
    const institutionNet20 = recent20.reduce((s: number, r: { institutionAmt: number }) => s + r.institutionAmt, 0);
    const individualNet20 = recent20.reduce((s: number, r: { individualAmt: number }) => s + r.individualAmt, 0);

    const data = {
      series,
      summary: {
        foreign20d: foreignNet20,
        institution20d: institutionNet20,
        individual20d: individualNet20,
        latestDate: series[series.length - 1]?.date,
      },
    };

    memCache = { data, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
