import { describe, expect, it } from "vitest";
import { assertTglIsolirDay } from "@/lib/ppp-bulk-tgl-isolir";

describe("assertTglIsolirDay", () => {
  it("accepts days 1 through 30", () => {
    expect(assertTglIsolirDay(1)).toBe(1);
    expect(assertTglIsolirDay(30)).toBe(30);
  });

  it("rejects 0, 31, and non-integers", () => {
    expect(() => assertTglIsolirDay(0)).toThrow(/1 dan 30/);
    expect(() => assertTglIsolirDay(31)).toThrow(/1 dan 30/);
    expect(() => assertTglIsolirDay(1.5)).toThrow(/1 dan 30/);
  });
});
