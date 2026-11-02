import type { NextRequest } from "next/server";

function trustForwardHeaders(): boolean {
  return (
    process.env.TRUST_FORWARD_HEADERS === "true" ||
    process.env.TRUST_FORWARD_HEADERS === "1"
  );
}

/**
 * IP untuk rate limiting dari header mentah (server actions, middleware helpers).
 * Secara default header X-Forwarded-For **tidak** dipakai karena mudah dipalsukan.
 * Set `TRUST_FORWARD_HEADERS=true` hanya bila aplikasi berada tepat di belakang
 * reverse proxy yang menimpa IP asli (X-Real-IP / cf-connecting-ip / XFF hop pertama).
 */
export function getTrustedClientIpFromHeaders(hdrs: Headers): string {
  if (trustForwardHeaders()) {
    const cf = hdrs.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
    const realIp = hdrs.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    const forwarded = hdrs.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/** IP untuk rate limiting pada NextRequest (API routes). */
export function getTrustedClientIp(request: NextRequest): string {
  const fromHeaders = getTrustedClientIpFromHeaders(request.headers);
  if (fromHeaders !== "unknown") return fromHeaders;

  const reqWithIp = request as NextRequest & { ip?: string | null };
  if (typeof reqWithIp.ip === "string" && reqWithIp.ip.length > 0) {
    return reqWithIp.ip;
  }

  return "unknown";
}
