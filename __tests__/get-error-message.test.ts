import { describe, expect, it } from "vitest";
import { getErrorMessage, getApiResponseErrorMessage } from "@/lib/get-error-message";

describe("getErrorMessage", () => {
  it("returns string errors as-is", () => {
    expect(getErrorMessage("Akses ditolak")).toBe("Akses ditolak");
  });

  it("returns Error.message", () => {
    expect(getErrorMessage(new Error("Gagal menyimpan"))).toBe("Gagal menyimpan");
  });

  it("extracts message from API response objects", () => {
    expect(getErrorMessage({ message: "Data Pelanggan berhasil diubah" })).toBe(
      "Data Pelanggan berhasil diubah"
    );
    expect(getErrorMessage({ error: "Data is not valid" })).toBe(
      "Data is not valid"
    );
  });

  it("extracts nested error.message", () => {
    expect(
      getErrorMessage({ error: { message: "Paket tidak ditemukan" } })
    ).toBe("Paket tidak ditemukan");
  });

  it("falls back when object cannot be stringified meaningfully", () => {
    expect(getErrorMessage({ details: { fieldErrors: {} } })).toBe(
      "Terjadi kesalahan"
    );
    expect(getErrorMessage({ details: {} }, "Gagal mengubah")).toBe(
      "Gagal mengubah"
    );
  });

  it("falls back when Error.message is [object Object]", () => {
    const bad = new Error({ error: "Data is not valid" } as unknown as string);
    expect(bad.message).toBe("[object Object]");
    expect(getErrorMessage(bad, "Gagal mengubah")).toBe("Gagal mengubah");
  });

  it("uses response status in api helper", () => {
    expect(
      getApiResponseErrorMessage({ details: {} }, { status: 400 })
    ).toBe("Permintaan gagal (400)");
  });
});
