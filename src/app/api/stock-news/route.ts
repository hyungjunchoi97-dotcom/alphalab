import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const [newsRes, infoRes] = await Promise.all([
      fetch(
        `https://m.stock.naver.com/api/news/stock/${code}?page=1&pageSize=3`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0)" }, signal: AbortSignal.timeout(8000) }
      ),
      fetch(
        `https://m.stock.naver.com/api/stock/${code}/integration`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0)" }, signal: AbortSignal.timeout(8000) }
      ),
    ]);

    // News
    let items: { title: string; officeName: string; datetime: string; url: string }[] = [];
    if (newsRes.ok) {
      const newsData = await newsRes.json();
      items = (newsData[0]?.items ?? []).map((item: Record<string, string>) => ({
        title: item.title,
        officeName: item.officeName,
        datetime: item.datetime,
        url: `https://n.news.naver.com/article/${item.officeId}/${item.articleId}`,
      }));
    }

    // Stock info
    let stockInfo: {
      marketCap: string;
      per: string;
      pbr: string;
      eps: string;
      dividendPerShare: string;
      payoutRatio: string;
    } | null = null;

    if (infoRes.ok) {
      const infoData = await infoRes.json();
      const totalInfos = infoData.totalInfos ?? [];
      const find = (key: string) =>
        totalInfos.find((t: Record<string, string>) => t.key === key)?.value ?? "-";
      const marketCap = find("marketCap");
      const per = find("per");
      const pbr = find("pbr");
      const eps = find("eps");
      const dividendPerShare = find("dividendPerShare");

      // payoutRatio = dividendPerShare / eps * 100
      const epsNum = parseFloat(String(eps).replace(/,/g, ""));
      const dpsNum = parseFloat(String(dividendPerShare).replace(/,/g, ""));
      const payoutRatio =
        epsNum > 0 && dpsNum > 0
          ? `${((dpsNum / epsNum) * 100).toFixed(1)}%`
          : "-";

      stockInfo = { marketCap, per, pbr, eps, dividendPerShare, payoutRatio };
    }

    return NextResponse.json(
      { ok: true, items, stockInfo },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
