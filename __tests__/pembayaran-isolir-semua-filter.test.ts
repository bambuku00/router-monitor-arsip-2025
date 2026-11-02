import { describe, expect, it } from "vitest";
import { pelangganRelevantForBillingMonth } from "@/lib/pembayaran-pelanggan-bayar-filter";

const ctx = {
  billingPeriod: "2026-08",
  billingStartMode: "NEXT_MONTH" as const,
  billingStartDate: null,
};

const pel = {
  id: 1,
  stop: false,
  tgl: "2020-01-01",
  paket: { harga: 100_000 },
};

describe("pelangganRelevantForBillingMonth isolir", () => {
  it("includes isolir pelanggan without tagihan bulan ini", () => {
    expect(
      pelangganRelevantForBillingMonth(pel, false, ctx, true)
    ).toBe(true);
  });

  it("excludes eligible aktif pelanggan without tagihan", () => {
    expect(
      pelangganRelevantForBillingMonth(pel, false, ctx, false)
    ).toBe(false);
  });

  it("still includes pelanggan with tagihan bulan ini", () => {
    expect(
      pelangganRelevantForBillingMonth(pel, true, ctx, false)
    ).toBe(true);
  });
});
