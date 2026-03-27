const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphalab-kappa.vercel.app";

export async function sendMessage(chatId: string, text: string, parseMode = "HTML"): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function today(): string {
  return new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(".", "");
}

export async function buildStockAlert(): Promise<string> {
  try {
    const [screenerRes, usNewsRes, krNewsRes] = await Promise.allSettled([
      fetch(`${APP_URL}/api/ideas/screener`, { signal: AbortSignal.timeout(30000) }).then(r => r.json()),
      fetch(`${APP_URL}/api/news?symbols=AAPL,MSFT,NVDA,TSLA,META`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch(`${APP_URL}/api/news/kr?category=stocks`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    ]);

    const screenerJson = screenerRes.status === "fulfilled" ? screenerRes.value : null;
    const usNewsJson = usNewsRes.status === "fulfilled" ? usNewsRes.value : null;
    const krNewsJson = krNewsRes.status === "fulfilled" ? krNewsRes.value : null;

    const krItems = (screenerJson?.fomoKr ?? [])
      .sort((a: { volumeRatio: number }, b: { volumeRatio: number }) => b.volumeRatio - a.volumeRatio)
      .slice(0, 5);

    let msg = `AlphaLab 주식 알림 - ${today()}\n\n`;

    if (krItems.length > 0) {
      msg += `한국 거래량 급증 TOP 5\n`;
      krItems.forEach((item: { nameKr?: string; name: string; ticker: string; volumeRatio: number; tag: string }, i: number) => {
        msg += `${i + 1}. ${item.nameKr || item.name} (${item.ticker}) | ${item.volumeRatio.toFixed(1)}배 | ${item.tag}\n`;
      });
    }

    const usNews = (usNewsJson?.news ?? []).slice(0, 3) as { headline: string; url: string }[];
    if (usNews.length > 0) {
      msg += `\n미국 시장 주요 뉴스\n`;
      usNews.forEach((n, i) => {
        if (n.url && n.url !== "#") {
          msg += `${i + 1}. <a href="${n.url}">${n.headline}</a>\n`;
        } else {
          msg += `${i + 1}. ${n.headline}\n`;
        }
      });
    }

    const krNews = (krNewsJson?.news ?? []).slice(0, 3) as { headline: string; url: string }[];
    if (krNews.length > 0) {
      msg += `\n한국 시장 주요 뉴스\n`;
      krNews.forEach((n, i) => {
        if (n.url && n.url !== "#") {
          msg += `${i + 1}. <a href="${n.url}">${n.headline}</a>\n`;
        } else {
          msg += `${i + 1}. ${n.headline}\n`;
        }
      });
    }

    msg += `\nthealphalabs.net/ideas`;
    return msg;
  } catch {
    return "";
  }
}

export async function buildMacroAlert(): Promise<string> {
  try {
    const [tickerRes, fgRes, newsRes] = await Promise.allSettled([
      fetch(`${APP_URL}/api/ticker`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch(`${APP_URL}/api/macro/fear-greed`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch(`${APP_URL}/api/news/kr?category=economy`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    ]);

    const ticker = tickerRes.status === "fulfilled" ? tickerRes.value : null;
    const fg = fgRes.status === "fulfilled" ? fgRes.value : null;
    const newsJson = newsRes.status === "fulfilled" ? newsRes.value : null;

    const market = (ticker?.market ?? []) as { label: string; value: number; changePct: number }[];
    const find = (label: string) => market.find(m => m.label === label);
    const nasdaq = find("NASDAQ");
    const wti = find("WTI Oil");
    const gold = find("Gold");
    const usdkrw = find("USD/KRW");
    const btc = find("Bitcoin");

    const fgScore = fg?.ok ? fg.data?.score : null;
    const fgLabel = fgScore != null
      ? (fgScore >= 75 ? "Extreme Greed" : fgScore >= 55 ? "Greed" : fgScore >= 45 ? "Neutral" : fgScore >= 25 ? "Fear" : "Extreme Fear")
      : null;

    const fmt = (v?: number) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-";
    const fmtPct = (v?: number) => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "";

    let msg = `AlphaLab 매크로 브리핑 - ${today()}\n\n`;
    if (fgScore != null) msg += `Fear &amp; Greed: ${fgScore} (${fgLabel})\n`;
    if (nasdaq) msg += `나스닥: ${fmt(nasdaq.value)} (${fmtPct(nasdaq.changePct)})\n`;
    if (wti) msg += `WTI 유가: $${fmt(wti.value)} (${fmtPct(wti.changePct)})\n`;
    if (gold) msg += `금: $${fmt(gold.value)} (${fmtPct(gold.changePct)})\n`;
    if (usdkrw) msg += `원달러 환율: ${fmt(usdkrw.value)}원 (${fmtPct(usdkrw.changePct)})\n`;
    if (btc) msg += `비트코인: $${fmt(btc.value)} (${fmtPct(btc.changePct)})\n`;

    const news = (newsJson?.news ?? []).slice(0, 3) as { headline: string; url: string }[];
    if (news.length > 0) {
      msg += `\n주요 뉴스\n`;
      news.forEach((n, i) => {
        if (n.url && n.url !== "#") {
          msg += `${i + 1}. <a href="${n.url}">${n.headline}</a>\n`;
        } else {
          msg += `${i + 1}. ${n.headline}\n`;
        }
      });
    }

    msg += `\nthealphalabs.net/macro`;
    return msg;
  } catch {
    return "";
  }
}

export async function buildCryptoAlert(): Promise<string> {
  try {
    const [tickerRes, newsRes] = await Promise.allSettled([
      fetch(`${APP_URL}/api/ticker`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch(`${APP_URL}/api/crypto/news?limit=3`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    ]);

    const ticker = tickerRes.status === "fulfilled" ? tickerRes.value : null;
    const newsJson = newsRes.status === "fulfilled" ? newsRes.value : null;

    const market = (ticker?.market ?? []) as { label: string; value: number; changePct: number }[];
    const btc = market.find(m => m.label === "Bitcoin");
    const eth = market.find(m => m.label === "Ethereum");

    const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

    let msg = `AlphaLab 크립토 브리핑 - ${today()}\n\n`;
    if (btc) msg += `비트코인: $${fmt(btc.value)} (${fmtPct(btc.changePct)})\n`;
    if (eth) msg += `이더리움: $${fmt(eth.value)} (${fmtPct(eth.changePct)})\n`;

    const news = (newsJson?.news ?? []).slice(0, 3) as { title: string; titleKr?: string; url?: string }[];
    if (news.length > 0) {
      msg += `\n주요 뉴스\n`;
      news.forEach((n, i) => {
        const title = n.titleKr || n.title;
        if (n.url) {
          msg += `${i + 1}. <a href="${n.url}">${title}</a>\n`;
        } else {
          msg += `${i + 1}. ${title}\n`;
        }
      });
    }

    msg += `\nthealphalabs.net/crypto`;
    return msg;
  } catch {
    return "";
  }
}

export async function buildRealestateAlert(): Promise<string> {
  try {
    const [seoulRes, newsRes] = await Promise.allSettled([
      fetch(`${APP_URL}/api/realestate/seoul`, { signal: AbortSignal.timeout(55000) }),
      fetch(`${APP_URL}/api/realestate/news?district=서울&limit=3`, { signal: AbortSignal.timeout(10000) }),
    ]);

    const seoulJson = seoulRes.status === "fulfilled" ? await seoulRes.value.json() : null;
    const newsJson = newsRes.status === "fulfilled" ? await newsRes.value.json() : null;

    if (!seoulJson?.ok) return "";

    const dealYmd = seoulJson.dealYmd ?? "";
    const ym = dealYmd ? `${dealYmd.slice(0, 4)}.${dealYmd.slice(4, 6)}` : "";

    let msg = `AlphaLab 부동산 브리핑 - ${today()}\n`;
    msg += `(${ym} 기준)\n`;

    // 1. 최고가 거래 TOP 5
    const topTrades = (seoulJson.recentTrades ?? []).slice(0, 5);
    if (topTrades.length > 0) {
      msg += `\n최고가 거래 TOP 5\n`;
      topTrades.forEach((t: { aptName: string; district: string; dong: string; area: number; floor: number; priceInBillion: number }, i: number) => {
        msg += `${i + 1}. ${t.aptName} (${t.district} ${t.dong}) ${t.priceInBillion}억 | ${Math.round(t.area)}㎡\n`;
      });
    }

    // 2. 구별 평균가 변동 TOP 3 (상승)
    const districts = (seoulJson.districts ?? []) as { name: string; avgPriceInBillion: number; change: number | null; count: number }[];
    const rising = districts
      .filter((d) => d.change !== null && d.change > 0)
      .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
      .slice(0, 3);
    if (rising.length > 0) {
      msg += `\n전월 대비 상승 구\n`;
      rising.forEach((d) => {
        msg += `${d.name}: ${d.avgPriceInBillion}억 (+${d.change}%)\n`;
      });
    }

    // 3. 거래량 급증 구 TOP 3
    const active = [...districts]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    if (active.length > 0) {
      msg += `\n거래량 TOP 3\n`;
      active.forEach((d) => {
        msg += `${d.name}: ${d.count}건 | 평균 ${d.avgPriceInBillion}억\n`;
      });
    }

    // 4. 부동산 뉴스
    const news = (newsJson?.news ?? []).slice(0, 3) as { title: string; url: string }[];
    if (news.length > 0) {
      msg += `\n주요 뉴스\n`;
      news.forEach((n: { title: string; url: string }, i: number) => {
        if (n.url) {
          msg += `${i + 1}. <a href="${n.url}">${n.title}</a>\n`;
        } else {
          msg += `${i + 1}. ${n.title}\n`;
        }
      });
    }

    msg += `\nthealphalabs.net/realestate`;
    return msg;
  } catch {
    return "";
  }
}
