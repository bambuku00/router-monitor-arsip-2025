import { describe, expect, it } from "vitest";
import {
  matchProfileOnRouter,
  pickRestoreProfile,
} from "@/lib/ppp-isolir-service";

describe("pickRestoreProfile", () => {
  it("uses profileBeforeIsolir when saved", () => {
    expect(
      pickRestoreProfile({
        profileBeforeIsolir: "10M",
        paketNama: "20M",
        isolirProfileName: "ISOLIR",
      })
    ).toBe("10M");
  });

  it("falls back to paket nama when backup missing", () => {
    expect(
      pickRestoreProfile({
        profileBeforeIsolir: null,
        paketNama: "10M",
        isolirProfileName: "ISOLIR",
      })
    ).toBe("10M");
  });

  it("returns null when no backup and no paket", () => {
    expect(
      pickRestoreProfile({
        profileBeforeIsolir: null,
        paketNama: null,
        isolirProfileName: "ISOLIR",
      })
    ).toBeNull();
  });
});

describe("matchProfileOnRouter", () => {
  it("matches case-insensitively", () => {
    expect(
      matchProfileOnRouter(["10m"], ["10M", "ISOLIR"])
    ).toBe("10M");
  });

  it("returns null when profile missing on router", () => {
    expect(matchProfileOnRouter(["20M"], ["10M", "ISOLIR"])).toBeNull();
  });
});
