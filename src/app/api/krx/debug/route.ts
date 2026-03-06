import { NextRequest, NextResponse } from "next/server";
import { resolveKrxKey } from "../movers/route";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const resolved = resolveKrxKey();
  const host = req.headers.get("host") ?? "(unknown)";

  return NextResponse.json({
    ok: true,
    nodeEnv: process.env.NODE_ENV ?? "(not set)",
    nowISO: new Date().toISOString(),
    portHint: host,
    envLoaded: !!(
      process.env.KRX_API_KEY ||
      process.env.KRX_AUTH_KEY ||
      process.env.AUTH_KEY ||
      process.env.KRX_KEY ||
      process.env.PB_ADMIN_TOKEN
    ),
    krx: {
      hasKey: !!resolved,
      keyEnvNameUsed: resolved?.envName ?? null,
      keyHint: resolved ? resolved.key.slice(0, 4) + "..." : "(not set)",
    },
    note: "Never expose full key",
  });
}
