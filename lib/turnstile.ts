import { createHash } from "node:crypto";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const USED_MS = 5 * 60 * 1000;

type UsedToken = { expiresAt: number };

const usedTokens = new Map<string, UsedToken>();

export type TurnstileVerdict = "ok" | "invalid" | "unavailable";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function rememberUsed(hash: string, now: number) {
  usedTokens.set(hash, { expiresAt: now + USED_MS });
}

function pruneUsed(now: number) {
  for (const [hash, row] of usedTokens) {
    if (row.expiresAt <= now) usedTokens.delete(hash);
  }
}

export function resetTurnstileStateForTests() {
  usedTokens.clear();
}

/**
 * Verifikasi token di Cloudflare Siteverify. Token kosong, kedaluwarsa,
 * atau yang sudah dipakai ditolak. Secret kosong atau layanan gagal
 * mengembalikan "unavailable" — pemanggil wajib menolak, bukan melewati.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<TurnstileVerdict> {
  const value = typeof token === "string" ? token.trim() : "";
  if (!value || value.length > 2048) return "invalid";

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  if (!secret) return "unavailable";

  const now = Date.now();
  pruneUsed(now);
  const hash = tokenHash(value);
  const seen = usedTokens.get(hash);
  if (seen && seen.expiresAt > now) return "invalid";

  const body = new URLSearchParams({ secret, response: value });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  try {
    const resp = await fetchImpl(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return "unavailable";
    const json = (await resp.json()) as { success?: boolean };
    if (json.success !== true) return "invalid";
    rememberUsed(hash, now);
    return "ok";
  } catch {
    return "unavailable";
  }
}
