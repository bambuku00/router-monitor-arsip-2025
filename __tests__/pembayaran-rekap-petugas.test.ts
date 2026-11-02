import { describe, expect, it } from "vitest";

import {
  pembayaranLunasKantorWhere,
  pelangganLunasKantorWhere,
} from "@/lib/pembayaran-rekap-petugas";

describe("rekap petugas menyembunyikan lunas kantor", () => {
  it("tidak memfilter bila tidak ada user kantor", () => {
    expect(pelangganLunasKantorWhere({ gte: "2026-10-01", lte: "2026-10-31" }, [])).toBeNull();
    expect(pembayaranLunasKantorWhere([])).toBeNull();
  });

  it("mengenali tagihan lunas yang dicatat admin atau keuangan", () => {
    expect(pembayaranLunasKantorWhere([4, 9])).toEqual({
      status: "Terbayar",
      OR: [
        { inputterId: { in: [4, 9] } },
        {
          inputterId: null,
          log: { some: { status: "Terbayar", inputterId: { in: [4, 9] } } },
        },
      ],
    });
  });
});
