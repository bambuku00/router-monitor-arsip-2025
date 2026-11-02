import { describe, expect, it } from "vitest";
import {
  isPlausiblePhone,
  isPortalTagihanGenerated,
  issuePelangganPortalSession,
  normalizePhoneDigits,
  readPelangganPortalLoginPath,
  readPelangganPortalSession,
} from "@/lib/pelanggan-portal";
import {
  portalPinError,
  portalSlugError,
  portalWaCsError,
  portalWaCsUrl,
} from "@/lib/portal-slug";

describe("portal pelanggan PPPoE", () => {
  it("menyamakan 08 dan 62", () => {
    expect(normalizePhoneDigits("0812-3456-7890")).toBe("081234567890");
    expect(normalizePhoneDigits("+62 812 3456 7890")).toBe("081234567890");
  });

  it("menolak nomor yang terlalu pendek", () => {
    expect(isPlausiblePhone("08123")).toBe(false);
    expect(isPlausiblePhone("081234567890")).toBe(true);
  });

  it("PIN portal boleh huruf dan karakter", () => {
    expect(portalPinError(null)).toBeNull();
    expect(portalPinError("1234")).toBeNull();
    expect(portalPinError("Ab#1")).toBeNull();
    expect(portalPinError("123")).toBeTruthy();
  });

  it("menolak link portal yang bentrok dengan halaman masuk", () => {
    expect(portalSlugError("masuk", true)).toBeTruthy();
    expect(portalSlugError("ab", true)).toBeTruthy();
    expect(portalSlugError(null, true)).toBeTruthy();
    expect(portalSlugError("demo-mitra", true)).toBeNull();
    expect(portalSlugError(null, false)).toBeNull();
  });

  it("cookie sesi menyimpan link mitra", () => {
    const token = issuePelangganPortalSession(42, undefined, "Demo-Mitra");
    expect(readPelangganPortalSession(token)).toBe(42);
    expect(readPelangganPortalLoginPath(token)).toBe("/pppoe/demo-mitra");
  });

  it("membuat link WhatsApp CS dari nomor lokal", () => {
    expect(portalWaCsError("081234567890")).toBeNull();
    expect(portalWaCsUrl("081234567890")).toBe("https://wa.me/6281234567890");
    expect(portalWaCsError("123")).toBe("Nomor CS 10–15 digit, diawali 0.");
  });

  it("menyembunyikan tagihan periode yang belum digenerate", () => {
    const generated = new Set(["2026-10"]);
    expect(isPortalTagihanGenerated("2026-10-20", generated)).toBe(true);
    expect(isPortalTagihanGenerated("2026-11-20", generated)).toBe(false);
  });

  it("cookie sesi hanya berlaku untuk id yang ditandatangani", () => {
    const token = issuePelangganPortalSession(42);
    expect(token).toBeTruthy();
    expect(readPelangganPortalSession(token)).toBe(42);
    expect(readPelangganPortalSession(`${token}x`)).toBeNull();
    expect(readPelangganPortalSession(null)).toBeNull();
  });
});
