import { describe, expect, it } from "vitest";

import { rekapTunaiTransferPerPaket } from "@/lib/penagih-rekap-metode";

describe("rekapTunaiTransferPerPaket", () => {
  it("menjumlahkan belum bayar, sudah bayar, tunai, dan transfer per paket", () => {
    expect(
      rekapTunaiTransferPerPaket([
        {
          status: "Terbayar",
          metode: "Cash",
          total: 100000,
          paket: { id: 2, nama: "20 Mbps", harga: 150000 },
        },
        {
          status: "Terbayar",
          metode: "Transfer",
          total: 150000,
          paket: { id: 2, nama: "20 Mbps", harga: 150000 },
        },
        {
          status: "Terbayar",
          metode: "Cash",
          total: 80000,
          paket: { id: 1, nama: "10 Mbps", harga: 100000 },
        },
        {
          status: "Belum",
          metode: "Cash",
          total: 100000,
          paket: { id: 1, nama: "10 Mbps", harga: 100000 },
        },
        {
          status: "Terbayar",
          metode: null,
          total: 50000,
          paket: { id: 1, nama: "10 Mbps", harga: 100000 },
        },
      ])
    ).toEqual([
      {
        paketId: 1,
        nama: "10 Mbps",
        harga: 100000,
        jumlahBelum: 1,
        nominalBelum: 100000,
        jumlahSudah: 2,
        nominalSudah: 130000,
        jumlahTunai: 1,
        nominalTunai: 80000,
        jumlahTransfer: 0,
        nominalTransfer: 0,
      },
      {
        paketId: 2,
        nama: "20 Mbps",
        harga: 150000,
        jumlahBelum: 0,
        nominalBelum: 0,
        jumlahSudah: 2,
        nominalSudah: 250000,
        jumlahTunai: 1,
        nominalTunai: 100000,
        jumlahTransfer: 1,
        nominalTransfer: 150000,
      },
    ]);
  });
});
