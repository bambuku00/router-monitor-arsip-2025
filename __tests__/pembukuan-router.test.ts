import { describe, expect, it } from "vitest";
import { summarizeRouterIncome } from "@/lib/pembukuan-router";

describe("summarizeRouterIncome", () => {
  it("totals received and unpaid income for every router", () => {
    const rows = summarizeRouterIncome(
      [
        {
          routerId: 2,
          routerNama: "POP Utara",
          status: "Terbayar",
          nominal: 100000,
        },
        {
          routerId: 2,
          routerNama: "POP Utara",
          status: "Belum",
          nominal: 50000,
        },
        {
          routerId: 1,
          routerNama: "POP Selatan",
          status: "Terbayar",
          nominal: 200000,
        },
      ],
      [
        { id: 1, nama: "POP Selatan" },
        { id: 3, nama: "POP Kosong" },
      ]
    );

    expect(rows.map((row) => row.nama)).toEqual([
      "POP Selatan",
      "POP Utara",
      "POP Kosong",
    ]);
    expect(rows[0]).toMatchObject({ diterima: 200000, belum: 0 });
    expect(rows[1]).toMatchObject({ diterima: 100000, belum: 50000 });
    expect(rows[2]).toMatchObject({ diterima: 0, belum: 0 });
  });
});