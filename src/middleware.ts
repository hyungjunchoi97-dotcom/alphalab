import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGIN = "https://www.thealphalabs.net";
const ALLOWED_ORIGINS = [
  "https://www.thealphalabs.net",
  "https://thealphalabs.net",
  "http://localhost:3000",
];

const BLOCKED_PATHS = [
  "/api/admin",
  "/api/cron",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin") || "";

  // 1. Block suspicious user agents (bots/scanners)
  const ua = req.headers.get("user-agent") || "";
  const blockedUAs = ["sqlmap", "nikto", "nmap", "masscan", "zgrab", "nuclei", "dirbuster", "gobuster"];
  if (blockedUAs.some((b) => ua.toLowerCase().includes(b))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 2. CORS for API routes
  if (pathname.startsWith("/api/")) {
    // Block cross-origin requests to sensitive endpoints
    if (BLOCKED_PATHS.some((p) => pathname.startsWith(p))) {
      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const res = NextResponse.next();

    // Set CORS headers
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin);
    } else {
      res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    }
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-XSS-Protection", "1; mode=block");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: res.headers });
    }

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
