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
    const res = await fetch(`${APP_URL}/api/ideas/screener`, { signal: AbortSignal.timeout(30000) });
    const json = await res.json();
    const items = (json.fomoKr ?? [])
      .sort((a: { volumeRatio: number }, b: { volumeRatio: number }) => b.volumeRatio - a.volumeRatio)
      .slice(0, 5);

    if (items.length === 0) return "";

    let msg = `AlphaLab 주식 알림 - ${today()}\n\n거래량 급증 종목 TOP 5\n`;

    items.forEach((item: { nameKr?: string; name: string; ticker: string; volumeRatio: number; tag: string }, i: number) => {
      msg += `\n${i + 1}. ${item.nameKr || item.name} (${item.ticker})`;
      msg += `\n   거래량: 평균 대비 ${item.volumeRatio.toFixed(1)}배`;
      msg += `\n   시그널: ${item.tag}\n`;
    });

    msg += `\nthealphalabs.net/ideas`;
    return msg;
  } catch {
    return "";
  }
}

export async function buildMacroAlert(): Promise<string> {
  try {
    const [tickerRes, fgRes] = await Promise.allSettled([
      fetch(`${APP_URL}/api/ticker`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch(`${APP_URL}/api/macro/fear-greed`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    ]);

    const ticker = tickerRes.status === "fulfilled" ? tickerRes.value : null;
    const fg = fgRes.status === "fulfilled" ? fgRes.value : null;

    const market = (ticker?.market ?? []) as { label: string; value: number; changePct: number }[];
    const find = (label: string) => market.find(m => m.label === label);

    const nasdaq = find("NASDAQ");
    const wti = find("WTI Oil");
    const gold = find("Gold");
    const usdkrw = find("USD/KRW");

    const fgScore = fg?.ok ? fg.data?.score : null;
    const fgLabel = fgScore != null
      ? (fgScore >= 75 ? "Extreme Greed" : fgScore >= 55 ? "Greed" : fgScore >= 45 ? "Neutral" : fgScore >= 25 ? "Fear" : "Extreme Fear")
      : null;

    const fmt = (v?: number) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-";
    const fmtPct = (v?: number) => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "";

    let msg = `AlphaLab 매크로 브리핑 - ${today()}\n`;
    if (fgScore != null) msg += `\nFear & Greed: ${fgScore} (${fgLabel})`;
    if (nasdaq) msg += `\n나스닥: ${fmt(nasdaq.value)} (${fmtPct(nasdaq.changePct)})`;
    if (wti) msg += `\nWTI 유가: $${fmt(wti.value)} (${fmtPct(wti.changePct)})`;
    if (gold) msg += `\n금: $${fmt(gold.value)} (${fmtPct(gold.changePct)})`;
    if (usdkrw) msg += `\n원달러 환율: ${fmt(usdkrw.value)}원 (${fmtPct(usdkrw.changePct)})`;
    msg += `\n\nthealphalabs.net/macro`;
    return msg;
  } catch {
    return "";
  }
}

export async function buildCryptoAlert(): Promise<string> {
  try {
    const [tickerRes, newsRes] = await Promise.allSettled([
      fetch(`${APP_URL}/api/ticker`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch(`${APP_URL}/api/crypto/news?limit=5`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    ]);

    const ticker = tickerRes.status === "fulfilled" ? tickerRes.value : null;
    const newsJson = newsRes.status === "fulfilled" ? newsRes.value : null;

    const market = (ticker?.market ?? []) as { label: string; value: number; changePct: number }[];
    const btc = market.find(m => m.label === "Bitcoin");

    const news = (newsJson?.news ?? []).slice(0, 2) as { title: string; titleKr?: string }[];

    let msg = `AlphaLab 크립토 브리핑 - ${today()}\n`;
    if (btc) {
      msg += `\n비트코인: $${btc.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${btc.changePct >= 0 ? "+" : ""}${btc.changePct.toFixed(1)}%)`;
    }

    if (news.length > 0) {
      msg += `\n\n주요 뉴스\n`;
      news.forEach((n, i) => {
        msg += `\n${i + 1}. ${n.titleKr || n.title}`;
      });
    }

    msg += `\n\nthealphalabs.net/crypto`;
    return msg;
  } catch {
    return "";
  }
}
