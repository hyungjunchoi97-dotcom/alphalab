import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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

  if (!body.pin || body.pin !== adminPin) {
    return NextResponse.json(
      { ok: false, error: "Invalid PIN" },
      { status: 401 }
    );
  }

  // Generate a simple random token
  const token =
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return NextResponse.json({ ok: true, token, expiresAt });
}
