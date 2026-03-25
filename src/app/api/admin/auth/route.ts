import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

// Simple in-memory rate limiter for PIN attempts
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PIN not configured" },
      { status: 500 }
    );
  }

  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.pin || typeof body.pin !== "string" || body.pin.length > 20) {
    return NextResponse.json(
      { ok: false, error: "Invalid PIN" },
      { status: 401 }
    );
  }

  // Constant-time comparison to prevent timing attacks
  const pinBuf = Buffer.from(body.pin);
  const adminBuf = Buffer.from(adminPin);
  if (pinBuf.length !== adminBuf.length || !timingSafeEqual(pinBuf, adminBuf)) {
    return NextResponse.json(
      { ok: false, error: "Invalid PIN" },
      { status: 401 }
    );
  }

  // Cryptographically secure token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return NextResponse.json({ ok: true, token, expiresAt });
}
