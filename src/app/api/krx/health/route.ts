import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  getBusinessDate,
  getCacheState,
  getLastFetchAt,
  resolveKrxKey,
} from "../movers/route";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const limited = checkRateLimit(req);
    if (limited) return limited;

    const resolved = resolveKrxKey();
    const hasKey = !!resolved;

    // KST now
    const nowKST = new Date(
      Date.now() + 9 * 60 * 60 * 1000
    ).toISOString().replace("Z", "+09:00");

    const resolvedBusinessDate = getBusinessDate();

    // Check admin token for full details
    const adminToken = process.env.PB_ADMIN_TOKEN;
    const reqToken = req.headers.get("x-admin-token");
    const isAdmin = !!adminToken && reqToken === adminToken;

    if (!isAdmin) {
      return NextResponse.json({
        ok: hasKey,
        nowKST,
        resolvedBusinessDate,
      });
    }

    return NextResponse.json({
      ok: hasKey,
      nowKST,
      resolvedBusinessDate,
      requestHost: req.headers.get("host") ?? "(unknown)",
      clientIp: getClientIp(req),
      krx: {
        hasKey,
        keyEnvNameUsed: resolved?.envName ?? null,
        keyHint: hasKey ? resolved!.key.slice(0, 4) + "..." : "(not set)",
      },
      cacheState: getCacheState(),
      lastFetchAtISO: getLastFetchAt() ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
