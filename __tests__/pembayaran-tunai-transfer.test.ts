import { describe, expect, it } from "vitest";

import {
  sumTransferPerBank,
  sumTunaiTransfer,
} from "@/lib/pembayaran-tagihan-statistik";

describe("sumTunaiTransfer", () => {
  it("menjumlahkan tagihan lunas menurut cara bayar", () => {
    expect(
      sumTunaiTransfer([
        { status: "Terbayar", metode: "Cash", total: 100000 },
        { status: "Terbayar", metode: "Transfer", total: 150000 },
        { status: "Terbayar", metode: "Cash", total: 50000 },
        { status: "Belum", metode: "Cash", total: 80000 },
        { status: "Terbayar", metode: null, total: 20000 },
      ])
    ).toEqual({
      tunai: 150000,
      transfer: 150000,
      jumlahTunai: 2,
      jumlahTransfer: 1,
    });
  });
});

describe("sumTransferPerBank", () => {
  it("mengelompokkan transfer lunas menurut nama bank", () => {
    expect(
      sumTransferPerBank([
        {
          status: "Terbayar",
          metode: "Transfer",
          total: 150000,
          bank: { bank: "BCA", norek: "123" },
        },
        {
          status: "Terbayar",
          metode: "Transfer",
          total: 100000,
          bank: { bank: "BRI", norek: "456" },
        },
        {
          status: "Terbayar",
          metode: "Transfer",
          total: 50000,
          bank: { bank: " bca ", norek: "123" },
        },
        {
          status: "Terbayar",
          metode: "Cash",
          total: 80000,
          bank: { bank: "BCA" },
        },
        {
          status: "Belum",
          metode: "Transfer",
          total: 70000,
          bank: { bank: "BRI" },
        },
      ])
    ).toEqual([
      { nama: "BCA", norek: "123", jumlah: 2, nominal: 200000 },
      { nama: "BRI", norek: "456", jumlah: 1, nominal: 100000 },
    ]);
  });
});
