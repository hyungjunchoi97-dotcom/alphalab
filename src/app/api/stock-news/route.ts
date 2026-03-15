import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const res = await fetch(
      `https://m.stock.naver.com/api/news/stock/${code}?page=1&pageSize=3`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0)" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return NextResponse.json({ ok: false }, { status: 500 });
    const data = await res.json();
    const items = (data[0]?.items ?? []).map((item: Record<string, string>) => ({
      title: item.title,
      officeName: item.officeName,
      datetime: item.datetime,
      url: `https://n.news.naver.com/article/${item.officeId}/${item.articleId}`,
    }));
    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
