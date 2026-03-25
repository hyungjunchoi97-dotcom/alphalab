import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    const res = await fetch("https://blockchain.info/unconfirmed-transactions?format=json", {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: true, txs: [], updatedAt: new Date().toISOString() });
    }
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txs = (json.txs ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((tx: any) => {
        const totalOut = (tx.out ?? []).reduce((s: number, o: { value?: number }) => s + (o.value ?? 0), 0);
        return totalOut > 100 * 1e8;
      })
      .slice(0, 20)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((tx: any) => {
        const totalOut = (tx.out ?? []).reduce((s: number, o: { value?: number }) => s + (o.value ?? 0), 0);
        return {
          hash: (tx.hash ?? "").slice(0, 8),
          time: tx.time ?? Math.floor(Date.now() / 1000),
          totalOutBtc: totalOut / 1e8,
        };
      });

    return NextResponse.json({ ok: true, txs, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: true, txs: [], updatedAt: new Date().toISOString() });
  }
}
