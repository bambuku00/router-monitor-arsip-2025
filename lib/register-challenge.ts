// @ts-nocheck — Buffer typing vs timingSafeEqual on newer @types/node.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Challenge anti-bot untuk registrasi publik (tanpa layanan CAPTCHA pihak ketiga).
 * Token = base64url(ts).base64url(hmac)
 * Valid ±5 menit. Secret: REGISTER_CHALLENGE_SECRET atau CRON_SECRET atau fallback dev.
 */

const WINDOW_MS = 5 * 60 * 1000;

function challengeSecret(): string {
  return (
    process.env.REGISTER_CHALLENGE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "dev-register-challenge")
  );
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function issueRegisterChallenge(): { token: string; expiresAt: number } {
  const secret = challengeSecret();
  if (!secret) {
    throw new Error("REGISTER_CHALLENGE_SECRET / CRON_SECRET belum di-set");
  }
  const ts = Date.now();
  const expiresAt = ts + WINDOW_MS;
  const mac = createHmac("sha256", secret).update(`register:${ts}`).digest();
  const token = `${b64url(Buffer.from(String(ts), "utf8"))}.${b64url(mac)}`;
  return { token, expiresAt };
}

export function verifyRegisterChallenge(
  token: string | null | undefined
): boolean {
  if (!token || typeof token !== "string") return false;
  const secret = challengeSecret();
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [tsB, macB] = parts;
  let ts: number;
  try {
    ts = parseInt(fromB64url(tsB).toString("utf8"), 10);
  } catch {
    return false;
  }
  if (!Number.isFinite(ts)) return false;
  const age = Date.now() - ts;
  if (age < -60_000 || age > WINDOW_MS) return false;

  const expected = createHmac("sha256", secret)
    .update(`register:${ts}`)
    .digest();
  let provided: Buffer;
  try {
    provided = fromB64url(macB);
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
