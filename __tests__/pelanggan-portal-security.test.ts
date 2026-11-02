import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assessPortalPhoneStep,
  PORTAL_OTP_INVALID,
  PORTAL_OTP_PENDING,
  PORTAL_PHONE_INVALID,
  PORTAL_RATE_LIMIT_ERROR,
  PORTAL_TURNSTILE_ERROR,
  PORTAL_UNAVAILABLE_ERROR,
  portalAttemptAllowed,
  portalRecordFailure,
  portalSendAllowed,
  portalRecordSend,
  resetPortalSecurityStateForTests,
  saveOtpChallenge,
  verifyOtpChallenge,
  isSameOriginRequest,
} from "@/lib/pelanggan-portal-security";
import {
  consumePelangganChoice,
  issuePelangganChoiceToken,
  issuePelangganPortalSession,
  isPlausiblePhone,
  portalSessionAllows,
  readPelangganPortalSession,
  resetPelangganPortalStateForTests,
  revokePelangganPortalSession,
} from "@/lib/pelanggan-portal";
import {
  resetTurnstileStateForTests,
  verifyTurnstileToken,
} from "@/lib/turnstile";

afterEach(() => {
  resetPortalSecurityStateForTests();
  resetPelangganPortalStateForTests();
  resetTurnstileStateForTests();
  delete process.env.TURNSTILE_SECRET_KEY;
  vi.restoreAllMocks();
});

describe("Turnstile", () => {
  it("menolak token kosong tanpa menghubungi Cloudflare", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret-test";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstileToken("  ", "127.0.0.1", fetchMock)).toBe(
      "invalid"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("menolak token yang Cloudflare tolak", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret-test";
    const fetchMock = vi.fn(async () =>
      Response.json({
        success: false,
        "error-codes": ["invalid-input-response"],
      })
    );
    expect(await verifyTurnstileToken("bad-token", "127.0.0.1", fetchMock)).toBe(
      "invalid"
    );
  });

  it("menolak token yang sudah dipakai", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret-test";
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    expect(await verifyTurnstileToken("once", "127.0.0.1", fetchMock)).toBe("ok");
    expect(await verifyTurnstileToken("once", "127.0.0.1", fetchMock)).toBe(
      "invalid"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tidak melewati proteksi bila secret kosong atau layanan gagal", async () => {
    const fetchMock = vi.fn();
    expect(await verifyTurnstileToken("token", "127.0.0.1", fetchMock)).toBe(
      "unavailable"
    );
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.TURNSTILE_SECRET_KEY = "secret-test";
    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await verifyTurnstileToken("token", "127.0.0.1", failing)).toBe(
      "unavailable"
    );
  });
});

describe("batas percobaan", () => {
  it("mengunci sementara lalu mengizinkan lagi, tidak permanen", () => {
    const now = 1_000_000;
    expect(portalAttemptAllowed("ip:a", now)).toBe(true);
    portalRecordFailure("ip:a", now);
    portalRecordFailure("ip:a", now);
    portalRecordFailure("ip:a", now);
    expect(portalAttemptAllowed("ip:a", now)).toBe(true);
    portalRecordFailure("ip:a", now);
    expect(portalAttemptAllowed("ip:a", now)).toBe(false);
    expect(portalAttemptAllowed("ip:a", now + 30_000)).toBe(true);
  });

  it("membatasi nomor HP terpisah dari IP", () => {
    const now = 5_000_000;
    portalRecordFailure("hp:081234567890", now);
    portalRecordFailure("hp:081234567890", now);
    portalRecordFailure("hp:081234567890", now);
    portalRecordFailure("hp:081234567890", now);
    expect(portalAttemptAllowed("hp:081234567890", now)).toBe(false);
    expect(portalAttemptAllowed("ip:lain", now)).toBe(true);
  });

  it("membatasi pengiriman kode dalam jendela waktu", () => {
    const phone = "081200000001";
    const now = 9_000_000;
    expect(portalSendAllowed(phone, now)).toBe(true);
    portalRecordSend(phone, now);
    portalRecordSend(phone, now);
    portalRecordSend(phone, now);
    expect(portalSendAllowed(phone, now)).toBe(false);
    expect(portalSendAllowed(phone, now + 10 * 60 * 1000)).toBe(true);
  });
});

describe("langkah nomor HP", () => {
  const ready = {
    originOk: true,
    turnstile: "ok" as const,
    phonePlausible: true,
    rateLimited: false,
    waConfigured: true,
  };

  it("tidak membuka akun dan tidak membocorkan nomor tidak terdaftar", () => {
    expect(assessPortalPhoneStep(ready)).toEqual({ allowOtp: true });
    expect(PORTAL_OTP_PENDING.toLowerCase()).not.toContain("tidak terdaftar");
    expect(PORTAL_UNAVAILABLE_ERROR.toLowerCase()).not.toContain("tidak terdaftar");
    expect(PORTAL_TURNSTILE_ERROR.toLowerCase()).not.toContain("tidak terdaftar");
  });

  it("menolak token tidak valid, layanan mati, dan nomor tidak masuk akal", () => {
    expect(assessPortalPhoneStep({ ...ready, turnstile: "invalid" })).toEqual({
      allowOtp: false,
      error: PORTAL_TURNSTILE_ERROR,
    });
    expect(assessPortalPhoneStep({ ...ready, turnstile: "unavailable" })).toEqual({
      allowOtp: false,
      error: PORTAL_UNAVAILABLE_ERROR,
    });
    expect(assessPortalPhoneStep({ ...ready, waConfigured: false })).toEqual({
      allowOtp: false,
      error: PORTAL_UNAVAILABLE_ERROR,
    });
    expect(assessPortalPhoneStep({ ...ready, phonePlausible: false })).toEqual({
      allowOtp: false,
      error: PORTAL_PHONE_INVALID,
    });
    expect(assessPortalPhoneStep({ ...ready, rateLimited: true })).toEqual({
      allowOtp: false,
      error: PORTAL_RATE_LIMIT_ERROR,
    });
    expect(assessPortalPhoneStep({ ...ready, originOk: false })).toEqual({
      allowOtp: false,
      error: PORTAL_UNAVAILABLE_ERROR,
    });
    expect(isPlausiblePhone("0812")).toBe(false);
    expect(isPlausiblePhone("abc")).toBe(false);
  });
});

describe("OTP dan sesi", () => {
  it("kode salah, kode kedaluwarsa, dan kode yang sudah dipakai ditolak", () => {
    const id = saveOtpChallenge({
      phone: "081234567890",
      code: "123456",
      pelangganIds: [7],
    });
    expect(id).toBeTruthy();
    expect(verifyOtpChallenge(id!, "000000").ok).toBe(false);
    expect(verifyOtpChallenge(id!, "123456")).toMatchObject({
      ok: true,
      pelangganIds: [7],
    });
    expect(verifyOtpChallenge(id!, "123456").ok).toBe(false);
    expect(PORTAL_OTP_INVALID.toLowerCase()).not.toContain("tidak terdaftar");
  });

  it("sesi baru tidak menerima id pelanggan lain, sesi dicabut, dan sesi kedaluwarsa mati", () => {
    const token = issuePelangganPortalSession(7);
    const other = issuePelangganPortalSession(8);
    expect(token).toBeTruthy();
    expect(other).not.toBe(token);
    expect(readPelangganPortalSession(token)).toBe(7);
    expect(portalSessionAllows(token, 7)).toBe(true);
    expect(portalSessionAllows(token, 8)).toBe(false);
    expect(readPelangganPortalSession(`${token}x`)).toBeNull();

    revokePelangganPortalSession(token);
    expect(readPelangganPortalSession(token)).toBeNull();

    const expired = issuePelangganPortalSession(7, Date.now() - 1000);
    expect(readPelangganPortalSession(expired)).toBeNull();
  });

  it("pilihan akun hanya untuk id yang diverifikasi dan hanya sekali", () => {
    const grant = issuePelangganChoiceToken([4, 5]);
    expect(consumePelangganChoice(grant, 9)).toBe(false);
    const again = issuePelangganChoiceToken([4, 5]);
    expect(consumePelangganChoice(again, 4)).toBe(true);
    expect(consumePelangganChoice(again, 4)).toBe(false);
  });

  it("origin asing ditolak", () => {
    expect(
      isSameOriginRequest({
        host: "localhost:3000",
        origin: "https://evil.example",
      })
    ).toBe(false);
    expect(
      isSameOriginRequest({
        host: "localhost:3000",
        origin: "http://localhost:3000",
      })
    ).toBe(true);
    expect(isSameOriginRequest({ host: "localhost:3000", origin: null })).toBe(
      false
    );
  });
});

describe("aksi login", () => {
  const source = readFileSync(
    resolve(process.cwd(), "lib/server-actions/pelanggan-portal-actions.ts"),
    "utf8"
  );

  it("masuk dengan nomor HP tanpa OTP WhatsApp, sesi tetap HttpOnly", () => {
    expect(source).not.toContain("verifyOtpChallenge");
    expect(source).not.toContain("sendPortalOtp");
    expect(source).toContain("issuePelangganPortalSession");
    expect(source).toContain("findEnabledPortalOwner");
    expect(source).toContain("portalPinStatus");
    expect(source).toContain("selectPortalMatchesForPin");
    expect(source).toContain("httpOnly: true");
    expect(source).toContain('sameSite: "lax"');
    expect(source).not.toContain("localStorage");
  });
});
