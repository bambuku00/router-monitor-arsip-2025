import { describe, expect, it } from "vitest";

import {
  portalTiketBalasanError,
  portalTiketInputError,
  portalTiketNoLayananDefault,
  portalTiketWaDefault,
} from "@/lib/portal-tiket";

describe("portal tiket input", () => {
  it("menerima keluhan dan lainnya yang lengkap", () => {
    expect(
      portalTiketInputError({
        kategori: "keluhan",
        judul: "Internet putus",
        pesan: "Sejak tadi malam koneksi sering terputus.",
        wa: "081234567890",
        prioritas: "tinggi",
      })
    ).toBeNull();
    expect(
      portalTiketInputError({
        kategori: "lainnya",
        judul: "Pindah alamat",
        pesan: "Mohon bantuan pengecekan saat pindah rumah.",
        wa: "6281234567890",
        prioritas: "normal",
      })
    ).toBeNull();
  });

  it("menolak jenis, judul, atau pesan yang tidak lengkap", () => {
    expect(
      portalTiketInputError({
        kategori: "rahasia",
        judul: "Internet putus",
        pesan: "Sejak tadi malam koneksi sering terputus.",
        wa: "081234567890",
        prioritas: "normal",
      })
    ).toBe("Pilih jenis tiket.");
    expect(
      portalTiketInputError({
        kategori: "keluhan",
        judul: "  ab ",
        pesan: "Sejak tadi malam koneksi sering terputus.",
        wa: "081234567890",
        prioritas: "normal",
      })
    ).toBe("Judul tiket 3–120 karakter.");
    expect(
      portalTiketInputError({
        kategori: "keluhan",
        judul: "Internet putus",
        pesan: "pendek",
        wa: "081234567890",
        prioritas: "normal",
      })
    ).toBe("Isi tiket 10–2000 karakter.");
    expect(
      portalTiketInputError({
        kategori: "keluhan",
        judul: "Internet putus",
        pesan: "Sejak tadi malam koneksi sering terputus.",
        wa: "123",
        prioritas: "normal",
      })
    ).toBe("Nomor WhatsApp 10–15 digit, diawali 0.");
    expect(
      portalTiketInputError({
        kategori: "keluhan",
        judul: "Internet putus",
        pesan: "Sejak tadi malam koneksi sering terputus.",
        wa: "081234567890",
        prioritas: "darurat",
      })
    ).toBe("Pilih prioritas tiket.");
  });

  it("mengisi nomor WhatsApp dari nomor terdaftar yang valid", () => {
    expect(portalTiketWaDefault("081234567890")).toBe("081234567890");
    expect(portalTiketWaDefault("6281234567890")).toBe("081234567890");
    expect(portalTiketWaDefault("-")).toBe("");
    expect(portalTiketNoLayananDefault("202601000001")).toBe("202601000001");
    expect(portalTiketNoLayananDefault("2026-0100-0001")).toBe("202601000001");
    expect(portalTiketNoLayananDefault("-")).toBe("");
  });

  it("menolak balasan yang terlalu panjang dan status asing", () => {
    expect(portalTiketBalasanError({ status: "tutup", balasan: "" })).toBe(
      "Status tiket tidak valid."
    );
    expect(
      portalTiketBalasanError({ status: "selesai", balasan: "x".repeat(2001) })
    ).toBe("Balasan maksimal 2000 karakter.");
    expect(portalTiketBalasanError({ status: "diproses", balasan: "" })).toBeNull();
  });
});
