import { describe, expect, it } from "vitest";

import {
  clampPetugasBulan,
  petugasBolehMencatatBayar,
  petugasVisibleMonths,
} from "@/lib/petugas-bulan";

describe("petugasVisibleMonths", () => {
  it("keeps the current month and the previous month", () => {
    expect(petugasVisibleMonths(new Date(2026, 9, 31))).toEqual([
      "2026-10",
      "2026-09",
    ]);
  });

  it("crosses into the previous year in January", () => {
    expect(petugasVisibleMonths(new Date(2026, 0, 15))).toEqual([
      "2026-01",
      "2025-12",
    ]);
  });
});

describe("petugasBolehMencatatBayar", () => {
  const now = new Date(2026, 9, 31);

  it("allows only the invoice for the current month", () => {
    expect(petugasBolehMencatatBayar("2026-10-20", now)).toBe(true);
    expect(petugasBolehMencatatBayar("2026-09-20", now)).toBe(false);
    expect(petugasBolehMencatatBayar("2026-11-20", now)).toBe(false);
  });
});

describe("clampPetugasBulan", () => {
  const now = new Date(2026, 9, 8);

  it("allows the current and previous month", () => {
    expect(clampPetugasBulan("2026-10", now)).toBe("2026-10");
    expect(clampPetugasBulan("2026-09", now)).toBe("2026-09");
  });

  it("returns the current month for any other period", () => {
    expect(clampPetugasBulan("2026-08", now)).toBe("2026-10");
    expect(clampPetugasBulan("2024-01", now)).toBe("2026-10");
    expect(clampPetugasBulan("", now)).toBe("2026-10");
    expect(clampPetugasBulan(null, now)).toBe("2026-10");
  });
});
