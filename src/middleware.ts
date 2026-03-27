import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://www.thealphalabs.net",
  "https://thealphalabs.net",
  "http://localhost:3000",
];

const BLOCKED_PATHS = ["/api/admin", "/api/cron"];

// Sensitive paths that require auth header
const AUTH_REQUIRED_PATHS = ["/api/admin", "/api/cron", "/api/newsletter"];

// Rate limiting store (in-memory, resets on cold start)
const ipRequestMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120; // requests per minute per IP
const RATE_WINDOW = 60_000;

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequestMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Clean up old entries every 100 requests
let cleanupCounter = 0;
function maybeCleanup() {
  cleanupCounter++;
  if (cleanupCounter % 100 !== 0) return;
  const now = Date.now();
  for (const [key, val] of ipRequestMap) {
    if (now > val.resetAt) ipRequestMap.delete(key);
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin") || "";
  const ua = req.headers.get("user-agent") || "";
  const ip = getIp(req);

  // 1. Block known scanners/bots
  const blockedUAs = [
    "sqlmap", "nikto", "nmap", "masscan", "zgrab", "nuclei",
    "dirbuster", "gobuster", "wfuzz", "hydra", "burpsuite",
    "python-requests/2", "go-http-client", "curl/7",
  ];
  if (blockedUAs.some((b) => ua.toLowerCase().includes(b))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 2. Block empty user agents on API routes (likely bots)
  if (pathname.startsWith("/api/") && !ua && req.method !== "OPTIONS") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 3. Rate limiting
  maybeCleanup();
  if (isRateLimited(ip)) {
    return new NextResponse(JSON.stringify({ ok: false, error: "rate_limited" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    });
  }

  // 4. Block cross-origin requests to sensitive endpoints
  if (BLOCKED_PATHS.some((p) => pathname.startsWith(p))) {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // 5. Block common vulnerability scan paths
  const suspiciousPaths = [
    "/.env", "/wp-admin", "/wp-login", "/.git",
    "/phpinfo", "/admin.php", "/.htaccess",
    "/config.php", "/setup.php", "/install.php",
    "/actuator", "/.well-known/security",
    "/api/../../", "/api/%2e%2e",
  ];
  if (suspiciousPaths.some((p) => pathname.toLowerCase().includes(p.toLowerCase()))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // 6. Block path traversal attempts
  if (pathname.includes("..") || pathname.includes("%2e%2e") || pathname.includes("%252e")) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // 7. CORS + security headers for API routes
  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next();

    if (ALLOWED_ORIGINS.includes(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin);
    } else {
      res.headers.set("Access-Control-Allow-Origin", "https://www.thealphalabs.net");
    }
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-XSS-Protection", "1; mode=block");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: res.headers });
    }

    return res;
  }

  // 8. Security headers for all pages
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)"],
};
