import { describe, expect, it } from "vitest";
import {
  classifyPaketsMissingFromMikrotik,
  routerNamesForPaket,
} from "@/lib/paket-mikrotik-presence";

const pakets = [
  { id: 1, nama: "10 Mbps", userId: 2, pelangganCount: 0 },
  { id: 2, nama: "20 Mbps", userId: 2, pelangganCount: 3 },
  { id: 3, nama: "Lama", userId: 2, pelangganCount: 0 },
  { id: 4, nama: "Dipakai Lama", userId: 2, pelangganCount: 1 },
  { id: 5, nama: "Milik Lain", userId: 9, pelangganCount: 0 },
];

describe("classifyPaketsMissingFromMikrotik", () => {
  it("menghapus yang tidak dipakai dan menandai yang masih dipakai", () => {
    const result = classifyPaketsMissingFromMikrotik({
      pakets,
      profilesByOwner: new Map([[2, new Set(["10 mbps", "20 mbps"])]]),
      ownersWithFailedRouter: new Set(),
    });
    expect(result.deletable.map((row) => row.id)).toEqual([3]);
    expect(result.usedMissing.map((row) => row.id)).toEqual([4]);
  });

  it("menunjukkan router yang punya nama paket yang sama", () => {
    const routers = [
      { nama: "Demo", userId: 2, names: new Set(["10 mbps"]) },
      { nama: "Cabang", userId: 2, names: new Set(["10 mbps", "20 mbps"]) },
      { nama: "Lain", userId: 9, names: new Set(["10 mbps"]) },
    ];
    expect(routerNamesForPaket({ nama: "10 Mbps", userId: 2 }, routers)).toEqual([
      "Demo",
      "Cabang",
    ]);
    expect(routerNamesForPaket({ nama: "Lama", userId: 2 }, routers)).toEqual([]);
  });

  it("tidak menyentuh pemilik yang routernya gagal dibaca", () => {
    const result = classifyPaketsMissingFromMikrotik({
      pakets,
      profilesByOwner: new Map([[2, new Set(["10 mbps"])]]),
      ownersWithFailedRouter: new Set([2]),
    });
    expect(result.deletable).toEqual([]);
    expect(result.usedMissing).toEqual([]);
  });
});
