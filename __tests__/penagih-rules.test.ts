import { describe, expect, it } from "vitest";
import {
  canAccessPenagihan,
  inactiveAssignmentError,
  shouldRecordAssignmentChange,
} from "@/lib/penagih-rules";

describe("penagih rules", () => {
  it("allows keuangan and blocks teknisi", () => {
    expect(canAccessPenagihan("Keuangan")).toBe(true);
    expect(canAccessPenagihan("Admin")).toBe(true);
    expect(canAccessPenagihan("Teknisi")).toBe(false);
  });

  it("rejects a new assignment for an inactive collector", () => {
    expect(inactiveAssignmentError(false)).toMatch(/nonaktif/);
    expect(inactiveAssignmentError(true)).toBeNull();
  });

  it("keeps history only when the collector actually changes", () => {
    expect(shouldRecordAssignmentChange(4, 4)).toBe(false);
    expect(shouldRecordAssignmentChange(null, 4)).toBe(true);
    expect(shouldRecordAssignmentChange(2, 4)).toBe(true);
  });
});
