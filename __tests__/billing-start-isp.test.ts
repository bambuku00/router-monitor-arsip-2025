import { describe, expect, it } from "vitest";
import {
  getFirstBillingMonth,
  isPelangganEligibleForBillingPeriod,
} from "@/lib/billing-start";

const isp = {
  billingStartMode: "NEXT_MONTH" as const,
  billingStartDate: null,
  ownedByIsp: true,
};

describe("ISP install billing cutoff", () => {
  it("bills next month when installed on or before the 25th", () => {
    expect(getFirstBillingMonth({ ...isp, tgl: "2026-10-18" })).toBe("2026-11");
    expect(getFirstBillingMonth({ ...isp, tgl: "2026-10-25" })).toBe("2026-11");
    expect(
      isPelangganEligibleForBillingPeriod({
        ...isp,
        tgl: "2026-10-24",
        period: "2026-10",
      })
    ).toBe(false);
    expect(
      isPelangganEligibleForBillingPeriod({
        ...isp,
        tgl: "2026-10-25",
        period: "2026-11",
      })
    ).toBe(true);
  });

  it("skips next month when installed after the 25th", () => {
    expect(getFirstBillingMonth({ ...isp, tgl: "2026-10-26" })).toBe("2026-12");
    expect(
      isPelangganEligibleForBillingPeriod({
        ...isp,
        tgl: "2026-10-26",
        period: "2026-11",
      })
    ).toBe(false);
    expect(
      isPelangganEligibleForBillingPeriod({
        ...isp,
        tgl: "2026-12-31",
        period: "2027-02",
      })
    ).toBe(true);
  });

  it("leaves mitra accounts on the existing grace rule", () => {
    expect(
      getFirstBillingMonth({
        tgl: "2026-09-20",
        billingStartMode: "NEXT_MONTH",
        billingStartDate: null,
        ownedByIsp: false,
      })
    ).toBe("2026-11");
    expect(
      getFirstBillingMonth({
        tgl: "2026-09-20",
        billingStartMode: "NEXT_MONTH",
        billingStartDate: null,
        ownedByIsp: true,
      })
    ).toBe("2026-10");
  });
});
