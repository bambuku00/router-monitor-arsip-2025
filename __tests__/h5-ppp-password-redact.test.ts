import { describe, it, expect } from "vitest";
import {
  redactPasswordFields,
  redactPppPasswordsUnlessSuperadmin,
  mayExposePppPasswords,
} from "@/lib/ppp-password-redact";

describe("H5: PPP password redaction helper", () => {
  it("strips top-level and nested password keys", () => {
    const input = {
      transactions: [
        { name: "a", password: "secret", profile: "p" },
        { nested: { password: "x", ok: 1 } },
      ],
      password: "root",
    };
    const out = redactPasswordFields(input);
    expect(out).toEqual({
      transactions: [{ name: "a", profile: "p" }, { nested: { ok: 1 } }],
    });
    expect(JSON.stringify(out)).not.toMatch(/password/);
  });

  it("Superadmin may see passwords; others redacted", () => {
    const rows = [{ name: "u", password: "p" }];
    expect(mayExposePppPasswords("Superadmin")).toBe(true);
    expect(redactPppPasswordsUnlessSuperadmin(rows, "Superadmin")).toEqual(rows);
    expect(redactPppPasswordsUnlessSuperadmin(rows, "Admin")).toEqual([
      { name: "u" },
    ]);
    expect(redactPppPasswordsUnlessSuperadmin(rows, "Teknisi")).toEqual([
      { name: "u" },
    ]);
  });
});
