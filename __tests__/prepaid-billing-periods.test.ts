import { describe, expect, it } from "vitest";
import {
  formatBillingPeriodLabel,
  prepaidBillingPeriods,
} from "@/lib/billing-due-date";

describe("prepaid billing periods", () => {
  it("menghitung bulan ini plus bulan berikutnya", () => {
    expect(prepaidBillingPeriods("2026-10-20", 3)).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(prepaidBillingPeriods("2026-11-20", 3)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("membatasi paling banyak 6 bulan", () => {
    expect(prepaidBillingPeriods("2026-10-20", 9)).toHaveLength(6);
    expect(prepaidBillingPeriods("2026-10-20", 1)).toEqual(["2026-10"]);
  });

  it("menulis nama bulan", () => {
    expect(formatBillingPeriodLabel("2026-10")).toMatch(/oktober 2026/i);
  });
});
