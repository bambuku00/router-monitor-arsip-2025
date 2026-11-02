import { describe, expect, it } from "vitest";
import { isMikrotikPppSecretActive, isPppSecretDisabled } from "@/lib/mikrotik-ppp-secret-active";

describe("isMikrotikPppSecretActive", () => {
  it("returns true when disabled is false or empty", () => {
    expect(isMikrotikPppSecretActive({ disabled: "false" })).toBe(true);
    expect(isMikrotikPppSecretActive({ disabled: "" })).toBe(true);
  });

  it("returns false when disabled is true or yes", () => {
    expect(isMikrotikPppSecretActive({ disabled: "true" })).toBe(false);
    expect(isMikrotikPppSecretActive({ disabled: "yes" })).toBe(false);
    expect(isMikrotikPppSecretActive({ disabled: "TRUE" })).toBe(false);
  });
});

describe("isPppSecretDisabled", () => {
  it("is true for a disabled secret even without an active session", () => {
    expect(isPppSecretDisabled({ disabled: "true" })).toBe(true);
    expect(isPppSecretDisabled({ disabled: "yes" })).toBe(true);
  });

  it("is false when the secret is enabled", () => {
    expect(isPppSecretDisabled({ disabled: "false" })).toBe(false);
    expect(isPppSecretDisabled({ disabled: "" })).toBe(false);
  });
});
