import { describe, expect, it } from "vitest";
import { isPppIsolir } from "@/lib/ppp-isolir";

describe("isPppIsolir", () => {
  it("does not treat a MikroTik-disabled secret as isolir", () => {
    expect(
      isPppIsolir(
        { disabled: "true", isIsolir: false, profile: "10M" },
        { isolirProfileName: "ISOLIR" }
      )
    ).toBe(false);
  });

  it("is isolir when the profile matches the isolir profile", () => {
    expect(
      isPppIsolir(
        { disabled: "false", isIsolir: false, profile: "ISOLIR" },
        { isolirProfileName: "ISOLIR" }
      )
    ).toBe(true);
  });

  it("is isolir when the app flag is set", () => {
    expect(
      isPppIsolir(
        { disabled: "false", isIsolir: true, profile: "10M" },
        { isolirProfileName: "ISOLIR" }
      )
    ).toBe(true);
  });
});
