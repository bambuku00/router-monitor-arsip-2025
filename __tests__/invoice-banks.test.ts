import { describe, expect, it } from "vitest";
import { banksVisibleOnUnpaidInvoice } from "@/lib/invoice-banks";

describe("banksVisibleOnUnpaidInvoice", () => {
  it("menyembunyikan rekening yang dikecualikan dari invoice belum lunas", () => {
    const banks = [
      { id: 1, hideFromUnpaidInvoice: false },
      { id: 2, hideFromUnpaidInvoice: true },
      { id: 3 },
    ];
    expect(banksVisibleOnUnpaidInvoice(banks).map((bank) => bank.id)).toEqual([1, 3]);
  });
});
