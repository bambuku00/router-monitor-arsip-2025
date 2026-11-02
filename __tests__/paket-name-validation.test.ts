import { describe, it, expect } from "vitest";
import { normalizePaketName } from "@/lib/paket-name-validation";

describe("normalizePaketName", () => {
  it("trims and lowercases for comparison", () => {
    expect(normalizePaketName(" 100M ")).toBe("100m");
    expect(normalizePaketName("Gratis")).toBe("gratis");
  });
});
