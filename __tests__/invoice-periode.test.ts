import { describe, expect, it } from "vitest";
import {
  clampDayInMonth,
  formatInvoicePaketLabel,
  invoiceIsolirDueDay,
  periodePaketFromJatuhTempo,
} from "@/lib/invoice-data";

describe("periodePaketFromJatuhTempo", () => {
  it("menampilkan bulan kalender sebelum jatuh tempo", () => {
    expect(periodePaketFromJatuhTempo("2026-10-20")).toEqual({
      awal: "1 September 2026",
      akhir: "30 September 2026",
    });
  });

  it("mundur ke Desember tahun sebelumnya bila jatuh tempo Januari", () => {
    expect(periodePaketFromJatuhTempo("2026-01-20")).toEqual({
      awal: "1 Desember 2025",
      akhir: "31 Desember 2025",
    });
  });

  it("memakai hari terakhir Februari pada tahun kabisat", () => {
    expect(periodePaketFromJatuhTempo("2024-03-20")).toEqual({
      awal: "1 Februari 2024",
      akhir: "29 Februari 2024",
    });
  });
});

describe("formatInvoicePaketLabel", () => {
  it("tidak mengulang kata PAKET yang sudah ada di nama", () => {
    expect(formatInvoicePaketLabel("PAKET LITE 110")).toBe("PAKET LITE 110");
    expect(formatInvoicePaketLabel("PAKET PAKET LITE 110")).toBe("PAKET LITE 110");
  });

  it("tetap menambah PAKET bila nama belum memuat kata itu", () => {
    expect(formatInvoicePaketLabel("5Mbps")).toBe("PAKET 5Mbps");
  });
});

describe("tanggal invoice dan jatuh tempo", () => {
  it("memakai tanggal isolir, atau tanggal 20 bila isolir kosong", () => {
    expect(invoiceIsolirDueDay(25)).toBe(25);
    expect(invoiceIsolirDueDay(null)).toBe(20);
    expect(invoiceIsolirDueDay(undefined)).toBe(20);
  });

  it("menahan tanggal 30 agar tidak melewati akhir Februari", () => {
    expect(clampDayInMonth(2026, 2, 30).getDate()).toBe(28);
    expect(clampDayInMonth(2026, 10, 25).getDate()).toBe(25);
  });
});
