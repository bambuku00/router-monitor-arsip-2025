import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RATE_LIMIT } from "@/lib/constants";
import { getTrustedClientIp } from "@/lib/request-ip";

// Catatan: Rate limit ini in-memory (Map). Hanya akurat di single instance.
// Untuk production multi-instance (Vercel/serverless), gunakan Redis (Upstash).
// Lihat ISSUES_TO_FIX.md #4 dan .env.example (UPSTASH_*).
//
// IP: Secara default rate limit memakai IP dari request (bukan X-Forwarded-For) agar
// tidak bisa dipalsukan dari klien. Jika aplikasi berada di belakang reverse proxy
// tepercaya, set TRUST_FORWARD_HEADERS=true dan pastikan proxy mem-set IP asli
// (mis. X-Real-IP / cf-connecting-ip).

const ipRequests = new Map<string, { count: number; expiresAt: number }>();

/**
 * Bangun CSP berbasis nonce per-request. `'strict-dynamic'` membuat browser modern
 * mengabaikan `'unsafe-inline'`/host-allowlist untuk script (hanya percaya nonce +
 * script yang di-load olehnya), sementara `'unsafe-inline'` tetap ada sebagai fallback
 * untuk browser lama (otomatis diabaikan browser yang mendukung CSP3).
 */
function buildCsp(nonce: string, isProd: boolean): string {
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https:`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProd = process.env.NODE_ENV === "production";

  if (!pathname.startsWith("/api")) {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const nonce = btoa(String.fromCharCode(...randomBytes));
    const csp = buildCsp(nonce, isProd);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    requestHeaders.set("x-nonce", nonce);
    // Next.js membaca CSP dari request header untuk menyuntikkan nonce ke <script> miliknya.
    requestHeaders.set("Content-Security-Policy", csp);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const ip = getTrustedClientIp(request);
  const now = Date.now();
  
  // Clean up expired entries (simple optimization)
  if (ipRequests.has(ip)) {
     const data = ipRequests.get(ip)!;
     if (now > data.expiresAt) {
       ipRequests.delete(ip);
     }
  }

  const data = ipRequests.get(ip) || { count: 0, expiresAt: now + RATE_LIMIT.WINDOW_MS };

  if (now > data.expiresAt) {
    data.count = 1;
    data.expiresAt = now + RATE_LIMIT.WINDOW_MS;
  } else {
    data.count++;
  }

  ipRequests.set(ip, data);

  if (data.count > RATE_LIMIT.MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
