import { describe, it, expect } from "vitest";
import {
  buildAmbiguousNormalizedNameSet,
  duplicatePaketDisplayLabels,
  findDuplicateNormalizedPaketNames,
  normalizePaketProfileName,
  resolvePaketForAutoFill,
} from "@/lib/ppp-bulk-fill-resolve-paket";

const PAID = { id: 1, nama: "100m", harga: 100_000 };
const FREE = { id: 2, nama: "gratis", harga: 0 };
const PAID_B = { id: 3, nama: "200m", harga: 200_000 };

describe("resolvePaketForAutoFill", () => {
  it("1. exact profile match to paid paket", () => {
    const r = resolvePaketForAutoFill({
      profile: "100M",
      pakets: [PAID, PAID_B],
      mode: "automatic",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.paket.id).toBe(PAID.id);
      expect(r.method).toBe("exact_match");
    }
  });

  it("2. exact profile match to Rp0 paket", () => {
    const r = resolvePaketForAutoFill({
      profile: " Gratis ",
      pakets: [FREE, PAID],
      mode: "automatic",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.paket.id).toBe(FREE.id);
      expect(r.method).toBe("exact_match");
    }
  });

  it("3. single paid paket + profile mismatch → paid fallback", () => {
    const r = resolvePaketForAutoFill({
      profile: "unknown-profile",
      pakets: [PAID],
      mode: "automatic",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.paket.id).toBe(PAID.id);
      expect(r.method).toBe("single_paid_fallback");
    }
  });

  it("4. single Rp0 paket + profile mismatch → skip", () => {
    const r = resolvePaketForAutoFill({
      profile: "unknown",
      pakets: [FREE],
      mode: "automatic",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("free_package_not_allowed_as_fallback");
    }
  });

  it("5. multiple pakets + profile mismatch + automatic → skip", () => {
    const r = resolvePaketForAutoFill({
      profile: "unknown",
      pakets: [PAID, PAID_B],
      mode: "automatic",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("package_profile_mismatch");
    }
  });

  it("6. multiple pakets + manual default selected", () => {
    const r = resolvePaketForAutoFill({
      profile: "unknown",
      pakets: [PAID, PAID_B],
      mode: "manual",
      defaultPaketId: PAID_B.id,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.paket.id).toBe(PAID_B.id);
      expect(r.method).toBe("manual_default");
    }
  });

  it("8. duplicate normalized paket names → ambiguous skip on exact match", () => {
    const dupA = { id: 10, nama: "100M", harga: 100_000 };
    const dupB = { id: 11, nama: "100m", harga: 150_000 };
    const r = resolvePaketForAutoFill({
      profile: "100m",
      pakets: [dupA, dupB],
      mode: "automatic",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("ambiguous_package_profile");
    }
  });

  it("does not partial-match profile names", () => {
    const r = resolvePaketForAutoFill({
      profile: "100",
      pakets: [PAID, PAID_B],
      mode: "automatic",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("package_profile_mismatch");
    }
  });
});

describe("duplicate paket name helpers", () => {
  it("findDuplicateNormalizedPaketNames detects case-insensitive duplicates", () => {
    expect(
      findDuplicateNormalizedPaketNames([
        { id: 1, nama: "100M", harga: 1 },
        { id: 2, nama: "100m", harga: 2 },
        { id: 3, nama: "200m", harga: 3 },
      ])
    ).toEqual(["100m"]);
  });

  it("duplicatePaketDisplayLabels returns one label per duplicate group", () => {
    const labels = duplicatePaketDisplayLabels([
      { id: 1, nama: "100M", harga: 1 },
      { id: 2, nama: "100m", harga: 2 },
    ]);
    expect(labels).toEqual(["100M"]);
  });

  it("normalizePaketProfileName trims and lowercases", () => {
    expect(normalizePaketProfileName("  Foo Bar  ")).toBe("foo bar");
  });

  it("buildAmbiguousNormalizedNameSet", () => {
    const set = buildAmbiguousNormalizedNameSet([
      { id: 1, nama: "A", harga: 1 },
      { id: 2, nama: "a", harga: 2 },
    ]);
    expect(set.has("a")).toBe(true);
  });
});
