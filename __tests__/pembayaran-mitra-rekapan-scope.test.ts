import { describe, expect, it } from "vitest";

import {
  mitraRekapanPembayaranWhere,
  mitraRekapanPembayaranWhereForBulan,
} from "@/lib/pembayaran-mitra-scope";

describe("mitraRekapanPembayaranWhere", () => {
  it("scopes by pelanggan router owner, not paket.userId", () => {
    expect(
      mitraRekapanPembayaranWhere(3, "2026-07-01", "2026-07-31")
    ).toEqual({
      jatuh_tempo: { gte: "2026-07-01", lte: "2026-07-31" },
      pelanggan: {
        router: { userId: 3, deleted: false },
      },
    });
  });

  it("supports PAID revenue basis status filter", () => {
    expect(
      mitraRekapanPembayaranWhere(3, "2026-07-01", "2026-07-31", {
        status: "Terbayar",
      })
    ).toMatchObject({ status: "Terbayar" });
  });

  it("matches month range helper used by tagihan statistik", () => {
    const where = mitraRekapanPembayaranWhereForBulan(3, "2026-07");
    expect(where).toEqual({
      jatuh_tempo: { gte: "2026-07-01", lte: "2026-07-31" },
      pelanggan: {
        router: { userId: 3, deleted: false },
      },
    });
  });
});
