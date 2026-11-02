import { describe, expect, it } from "vitest";
import {
  listSubscriptionMonths,
  subscriptionDateInMonth,
  subscriptionYearMonth,
} from "@/lib/ppp-subscription-month";

describe("subscriptionDateInMonth", () => {
  it("keeps the day when only the month and year change", () => {
    expect(subscriptionDateInMonth("2026-10-18", 2026, 9)).toBe("2026-09-18");
    expect(subscriptionDateInMonth("2026-10-25", 2025, 11)).toBe("2025-11-25");
  });

  it("clamps a day that does not exist in the target month", () => {
    expect(subscriptionDateInMonth("2026-01-31", 2026, 2)).toBe("2026-02-28");
    expect(subscriptionDateInMonth("2024-01-31", 2024, 2)).toBe("2024-02-29");
  });

  it("uses day 1 when the stored date has no day", () => {
    expect(subscriptionDateInMonth("", 2026, 10)).toBe("2026-10-01");
  });

  it("sets one shared day and clamps it to the target month", () => {
    expect(subscriptionDateInMonth("2026-10-18", 2026, 9, 5)).toBe("2026-09-05");
    expect(subscriptionDateInMonth("2026-10-18", 2026, 2, 31)).toBe("2026-02-28");
  });
});

describe("listSubscriptionMonths", () => {
  it("keeps the same month apart when the day differs", () => {
    expect(
      listSubscriptionMonths([
        "2026-10-18",
        "2026-10-18",
        "2026-10-25",
        "2026-09-01",
        "",
        "bukan-tanggal",
      ])
    ).toEqual([
      { tanggal: "2026-10-25", count: 1 },
      { tanggal: "2026-10-18", count: 2 },
      { tanggal: "2026-09-01", count: 1 },
    ]);
  });

  it("matches a date to its year-month", () => {
    expect(subscriptionYearMonth("2026-10-18")).toBe("2026-10");
    expect(subscriptionYearMonth("2026-09-01")).not.toBe("2026-10");
  });
});
