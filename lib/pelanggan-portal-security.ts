import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const PORTAL_TURNSTILE_ERROR = "Verifikasi keamanan gagal. Coba lagi.";
export const PORTAL_RATE_LIMIT_ERROR =
  "Terlalu banyak percobaan. Coba lagi nanti.";
export const PORTAL_UNAVAILABLE_ERROR =
  "Tidak dapat masuk saat ini. Coba lagi nanti.";
export const PORTAL_PHONE_INVALID = "Masukkan nomor HP yang benar.";
export const PORTAL_OTP_PENDING =
  "Jika nomor terdaftar, kode verifikasi dikirim ke WhatsApp.";
export const PORTAL_OTP_INVALID = "Kode tidak valid. Coba lagi.";

const OTP_MS = 5 * 60 * 1000;
const OTP_ATTEMPTS = 5;
const SEND_WINDOW_MS = 10 * 60 * 1000;
const SEND_MAX = 3;
const FAILURE_RESET_MS = 24 * 60 * 60 * 1000;

type FailureBucket = {
  failures: number;
  lockedUntil: number;
  touchedAt: number;
};

type OtpChallenge = {
  phone: string;
  codeHash: string;
  pelangganIds: number[];
  exp: number;
  attempts: number;
};

type SendWindow = { count: number; windowStart: number };

const failures = new Map<string, FailureBucket>();
const challenges = new Map<string, OtpChallenge>();
const sends = new Map<string, SendWindow>();

function portalSecret(): string {
  return (
    process.env.REGISTER_CHALLENGE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "dev-register-challenge")
  );
}

export function resetPortalSecurityStateForTests() {
  failures.clear();
  challenges.clear();
  sends.clear();
}

export function isSameOriginRequest(input: {
  host: string | null;
  origin: string | null;
}): boolean {
  if (!input.host || !input.origin) return false;
  try {
    return new URL(input.origin).host === input.host;
  } catch {
    return false;
  }
}

export function waOtpConfigured(): boolean {
  return Boolean(process.env.WOOWA_DEVICE_ID?.trim());
}

function backoffMs(failureCount: number): number {
  if (failureCount <= 3) return 0;
  if (failureCount === 4) return 30_000;
  if (failureCount === 5) return 120_000;
  if (failureCount === 6) return 600_000;
  return 1_800_000;
}

export function portalAttemptAllowed(key: string, now = Date.now()): boolean {
  const bucket = failures.get(key);
  if (!bucket) return true;
  if (now - bucket.touchedAt > FAILURE_RESET_MS) {
    failures.delete(key);
    return true;
  }
  return now >= bucket.lockedUntil;
}

export function portalRecordFailure(key: string, now = Date.now()) {
  const prev = failures.get(key);
  const fresh = !prev || now - prev.touchedAt > FAILURE_RESET_MS;
  const count = fresh ? 1 : prev.failures + 1;
  const delay = backoffMs(count);
  failures.set(key, {
    failures: count,
    lockedUntil: now + delay,
    touchedAt: now,
  });
}

export function portalClearFailures(key: string) {
  failures.delete(key);
}

export function portalSendAllowed(phone: string, now = Date.now()): boolean {
  const row = sends.get(phone);
  if (!row || now - row.windowStart >= SEND_WINDOW_MS) return true;
  return row.count < SEND_MAX;
}

export function portalRecordSend(phone: string, now = Date.now()) {
  const row = sends.get(phone);
  if (!row || now - row.windowStart >= SEND_WINDOW_MS) {
    sends.set(phone, { count: 1, windowStart: now });
    return;
  }
  row.count += 1;
}

function hashCode(challengeId: string, code: string): string | null {
  const secret = portalSecret();
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update(`portal-otp:${challengeId}:${code}`)
    .digest("hex");
}

export function saveOtpChallenge(input: {
  phone: string;
  code: string;
  pelangganIds: number[];
}): string | null {
  const id = randomBytes(16).toString("hex");
  const codeHash = hashCode(id, input.code);
  if (!codeHash) return null;
  challenges.set(id, {
    phone: input.phone,
    codeHash,
    pelangganIds: input.pelangganIds,
    exp: Date.now() + OTP_MS,
    attempts: 0,
  });
  return id;
}

export function verifyOtpChallenge(
  challengeId: string,
  code: string
): { ok: true; phone: string; pelangganIds: number[] } | { ok: false } {
  const row = challenges.get(challengeId);
  if (!row) return { ok: false };
  if (row.exp < Date.now() || row.attempts >= OTP_ATTEMPTS) {
    challenges.delete(challengeId);
    return { ok: false };
  }
  const digits = code.trim();
  if (!/^\d{6}$/.test(digits)) {
    row.attempts += 1;
    if (row.attempts >= OTP_ATTEMPTS) challenges.delete(challengeId);
    return { ok: false };
  }
  const actual = hashCode(challengeId, digits);
  const expected = Buffer.from(row.codeHash, "hex");
  const provided = actual ? Buffer.from(actual, "hex") : Buffer.alloc(0);
  const match =
    actual != null &&
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);
  if (!match) {
    row.attempts += 1;
    if (row.attempts >= OTP_ATTEMPTS) challenges.delete(challengeId);
    return { ok: false };
  }
  challenges.delete(challengeId);
  return { ok: true, phone: row.phone, pelangganIds: row.pelangganIds };
}

export function generatePortalOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export type PhoneStepInput = {
  originOk: boolean;
  turnstile: "ok" | "invalid" | "unavailable";
  phonePlausible: boolean;
  rateLimited: boolean;
  waConfigured: boolean;
};

/** Langkah nomor HP tidak pernah membuka sesi akun. */
export function assessPortalPhoneStep(
  input: PhoneStepInput
): { allowOtp: true } | { allowOtp: false; error: string } {
  if (!input.originOk) return { allowOtp: false, error: PORTAL_UNAVAILABLE_ERROR };
  if (input.rateLimited) {
    return { allowOtp: false, error: PORTAL_RATE_LIMIT_ERROR };
  }
  if (input.turnstile === "invalid") {
    return { allowOtp: false, error: PORTAL_TURNSTILE_ERROR };
  }
  if (input.turnstile === "unavailable") {
    return { allowOtp: false, error: PORTAL_UNAVAILABLE_ERROR };
  }
  if (!input.phonePlausible) {
    return { allowOtp: false, error: PORTAL_PHONE_INVALID };
  }
  if (!input.waConfigured) {
    return { allowOtp: false, error: PORTAL_UNAVAILABLE_ERROR };
  }
  return { allowOtp: true };
}

/** Kirim kode sungguhan. Tanpa WOOWA_DEVICE_ID tidak mengirim dan tidak berpura-pura terkirim. */
export async function sendPortalOtp(
  phoneLocal: string,
  code: string
): Promise<boolean> {
  const deviceId = process.env.WOOWA_DEVICE_ID?.trim();
  if (!deviceId) return false;
  const digits = phoneLocal.replace(/\D/g, "");
  const number = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  if (!/^62\d{8,13}$/.test(number)) return false;
  try {
    const resp = await fetch("https://crm.woo-wa.com/send/message-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        number: Number(number),
        message: `Kode masuk Portal Pelanggan: ${code}. Berlaku 5 menit. Jangan berikan kode ini kepada siapa pun.`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return false;
    const json = (await resp.json().catch(() => null)) as {
      success?: boolean;
    } | null;
    if (json && json.success === false) return false;
    return true;
  } catch {
    return false;
  }
}
