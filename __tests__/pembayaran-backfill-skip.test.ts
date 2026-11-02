import { describe, expect, it } from "vitest";
import { selectBillingPeriodsToCreate } from "@/lib/pembayaran-backfill";

describe("selectBillingPeriodsToCreate", () => {
  it("melewati bulan yang sudah ada dan bulan yang dihapus", () => {
    const dates = ["2026-08-20", "2026-09-20", "2026-10-20"];
    const result = selectBillingPeriodsToCreate(
      dates,
      new Set(["2026-08"]),
      new Set(["2026-10"])
    );
    expect(result).toEqual(["2026-09-20"]);
  });
});
