import { describe, expect, it } from "vitest";
import {
  jakartaMonthStart,
  packageChangeAllowed,
  packageChangeQuotaMessage,
} from "@/lib/ppp-package-change-quota";

describe("package change monthly quota", () => {
  it("allows changes when the limit is empty", () => {
    expect(packageChangeAllowed(20, null)).toBe(true);
  });

  it("stops at the monthly limit, including zero", () => {
    expect(packageChangeAllowed(2, 3)).toBe(true);
    expect(packageChangeAllowed(3, 3)).toBe(false);
    expect(packageChangeAllowed(0, 0)).toBe(false);
  });

  it("uses the start of the Jakarta month", () => {
    const start = jakartaMonthStart(new Date("2026-10-22T02:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });

  it("explains a full quota for one direction", () => {
    expect(packageChangeQuotaMessage("upgrade", 1, 1)).toContain("Upgrade");
    expect(packageChangeQuotaMessage("upgrade", 1, 1)).toContain("1 dari 1");
    expect(packageChangeQuotaMessage("downgrade", 0, 0)).toContain("dimatikan");
  });
});
