import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";
export const maxDuration = 30;

const MOLIT_KEY = process.env.MOLIT_API_KEY ?? "";
const ENDPOINT = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const xmlParser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "11410";
  const ym = request.nextUrl.searchParams.get("ym") ?? "202602";
  const url = `${ENDPOINT}?serviceKey=${MOLIT_KEY}&LAWD_CD=${code}&DEAL_YMD=${ym}&numOfRows=200&pageNo=1`;
  const res = await fetch(url);
  const text = await res.text();
  const parsed = xmlParser.parse(text);
  const items = parsed?.response?.body?.items?.item;
  const arr = items ? (Array.isArray(items) ? items : [items]) : [];
  const names = [...new Set(arr.map((i: Record<string, unknown>) => String(i.aptNm ?? "").trim()))].sort();
  return NextResponse.json({ code, ym, count: arr.length, names });
}
