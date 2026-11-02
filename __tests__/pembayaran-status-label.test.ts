import { describe, expect, it } from "vitest";
import { pembayaranTransferBankName } from "@/lib/pembayaran-types";

describe("pembayaranTransferBankName", () => {
  it("shows the bank under a paid transfer", () => {
    expect(
      pembayaranTransferBankName({
        status: "Terbayar",
        metode: "Transfer",
        bank: { bank: "BRI" },
      })
    ).toBe("BRI");
  });

  it("hides the bank for cash and unpaid invoices", () => {
    expect(
      pembayaranTransferBankName({
        status: "Terbayar",
        metode: "Cash",
        bank: { bank: "BCA" },
      })
    ).toBeNull();
    expect(
      pembayaranTransferBankName({
        status: "Belum",
        metode: "Transfer",
        bank: { bank: "BCA" },
      })
    ).toBeNull();
    expect(
      pembayaranTransferBankName({
        status: "Terbayar",
        metode: "Transfer",
        bank: null,
      })
    ).toBeNull();
  });
});
