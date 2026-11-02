import { describe, expect, it } from "vitest";
import { boosterDaysLeft, boosterEndsAt } from "@/lib/ppp-booster";

describe("ppp booster duration", () => {
  const now = new Date("2026-10-22T08:00:00.000Z");

  it("menolak lama di luar 1 sampai 6 hari", () => {
    expect(boosterEndsAt(0, now)).toBeNull();
    expect(boosterEndsAt(7, now)).toBeNull();
    expect(boosterEndsAt(1.5, now)).toBeNull();
  });

  it("1 hari berakhir 24 jam kemudian", () => {
    expect(boosterEndsAt(1, now)?.toISOString()).toBe("2026-10-23T08:00:00.000Z");
    expect(boosterEndsAt(6, now)?.toISOString()).toBe("2026-10-28T08:00:00.000Z");
  });

  it("sisa hari dibulatkan ke atas", () => {
    const ends = new Date("2026-10-23T08:00:00.000Z");
    expect(boosterDaysLeft(ends, now)).toBe(1);
    expect(boosterDaysLeft(ends, new Date("2026-10-23T07:00:00.000Z"))).toBe(1);
    expect(boosterDaysLeft(ends, new Date("2026-10-23T08:00:00.000Z"))).toBe(0);
  });
});
