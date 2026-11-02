// @ts-nocheck — Node Buffer vs Uint8Array typing conflict on newer @types/node; runtime AES-GCM is correct.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Envelope encryption for Router.password at rest.
 * Format: enc:v1:<iv_b64url>:<tag_b64url>:<ct_b64url>
 * Legacy plaintext rows (tanpa prefix) tetap bisa dibaca sampai di-migrasi.
 *
 * Key: ROUTER_PASSWORD_ENCRYPTION_KEY — 32-byte hex (64 char) atau base64 (44 char).
 * Generate: openssl rand -hex 32
 */

const PREFIX = "enc:v1:";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function getKey(): Buffer | null {
  const raw = process.env.ROUTER_PASSWORD_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export function isEncryptedRouterPassword(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypt plaintext for DB storage. Throws in production if key missing. */
export function encryptRouterPassword(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (isEncryptedRouterPassword(plaintext)) return plaintext;

  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ROUTER_PASSWORD_ENCRYPTION_KEY wajib di production. Generate: openssl rand -hex 32"
      );
    }
    return plaintext;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${b64url(iv)}:${b64url(tag)}:${b64url(ct)}`;
}

/** Decrypt for RouterOS connect. Plaintext legacy returned as-is. */
export function decryptRouterPassword(stored: string): string {
  if (!stored) return stored;
  if (!isEncryptedRouterPassword(stored)) return stored;

  const key = getKey();
  if (!key) {
    throw new Error(
      "Password router terenkripsi tetapi ROUTER_PASSWORD_ENCRYPTION_KEY belum di-set"
    );
  }

  const body = stored.slice(PREFIX.length);
  const parts = body.split(":");
  if (parts.length !== 3) {
    throw new Error("Format password router terenkripsi tidak valid");
  }
  const iv = fromB64url(parts[0]);
  const tag = fromB64url(parts[1]);
  const ct = fromB64url(parts[2]);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8"
  );
}

export function hasRouterPasswordEncryptionKey(): boolean {
  return getKey() != null;
}

/** Exported for tests — constant-time compare helper. */
export function _timingSafeEqualBuf(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
