import { describe, expect, it } from "vitest";
import { sortDiprosesKeys } from "@/lib/pembayaran-diproses-sort";

const rows = [
  { id: 1, nama: "Citra", label: "Budi (Admin)", at: new Date("2026-10-02T01:00:00Z").getTime() },
  { id: 2, nama: "Ani", label: "Ani (Keuangan)", at: new Date("2026-10-20T01:00:00Z").getTime() },
  { id: 3, nama: "Budi", label: "", at: null },
];

describe("sortDiprosesKeys", () => {
  it("orders processor names alphabetically and leaves blanks last", () => {
    expect(sortDiprosesKeys(rows, "nama").map((row) => row.id)).toEqual([2, 1, 3]);
  });

  it("puts the newest processed time first and blanks last", () => {
    expect(sortDiprosesKeys(rows, "tanggal").map((row) => row.id)).toEqual([2, 1, 3]);
  });
});
