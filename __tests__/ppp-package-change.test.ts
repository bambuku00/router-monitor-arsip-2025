import { describe, expect, it } from "vitest";
import { listPackageChangeTargets } from "@/lib/ppp-package-change";

const current = { id: 2, nama: "10 Mbps", kapasitas: 10, harga: 150000 };
const pakets = [
  { id: 1, nama: "5 Mbps", kapasitas: 5, harga: 100000 },
  current,
  { id: 3, nama: "20 Mbps", kapasitas: 20, harga: 200000 },
  { id: 4, nama: "50 Mbps", kapasitas: 50, harga: 300000 },
  { id: 5, nama: "Khusus", kapasitas: 30, harga: 250000 },
  { id: 6, nama: "ISOLIR", kapasitas: 1, harga: 0 },
];
const profiles = ["5 Mbps", "10 Mbps", "20 Mbps", "50 Mbps", "ISOLIR"];

describe("listPackageChangeTargets", () => {
  it("lists higher profiles that exist on the router, nearest first", () => {
    const targets = listPackageChangeTargets({
      direction: "upgrade",
      current,
      pakets,
      routerProfiles: profiles,
      isolirProfileName: "ISOLIR",
    });
    expect(targets.map((row) => row.nama)).toEqual(["20 Mbps", "Khusus", "50 Mbps"]);
  });

  it("lists lower profiles, nearest first, and skips the isolir profile", () => {
    const targets = listPackageChangeTargets({
      direction: "downgrade",
      current,
      pakets,
      routerProfiles: profiles,
      isolirProfileName: "ISOLIR",
    });
    expect(targets.map((row) => row.id)).toEqual([1]);
  });

  it("keeps a higher package even when its profile name differs", () => {
    const targets = listPackageChangeTargets({
      direction: "upgrade",
      current,
      pakets,
      routerProfiles: ["20 Mbps"],
      isolirProfileName: "ISOLIR",
    });
    expect(targets.map((row) => row.nama)).toEqual(["20 Mbps", "Khusus", "50 Mbps"]);
    expect(targets[0]?.profile).toBe("20 Mbps");
    expect(targets[2]?.profile).toBe("50 Mbps");
  });

  it("keeps the router profile spelling", () => {
    const targets = listPackageChangeTargets({
      direction: "upgrade",
      current,
      pakets,
      routerProfiles: ["20 mbps"],
      isolirProfileName: null,
    });
    expect(targets.find((row) => row.id === 3)?.profile).toBe("20 mbps");
  });
});
