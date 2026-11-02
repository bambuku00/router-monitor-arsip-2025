export type RekapMetodeSumber = {
  total: number;
  metode: "Cash" | "Transfer" | null;
  status: string;
  paket: { id: number; nama: string; harga: number };
};

export type RekapMetodeBaris = {
  paketId: number;
  nama: string;
  harga: number;
  jumlahBelum: number;
  nominalBelum: number;
  jumlahSudah: number;
  nominalSudah: number;
  jumlahTunai: number;
  nominalTunai: number;
  jumlahTransfer: number;
  nominalTransfer: number;
};

function emptyBaris(paket: RekapMetodeSumber["paket"]): RekapMetodeBaris {
  return {
    paketId: paket.id,
    nama: paket.nama,
    harga: paket.harga,
    jumlahBelum: 0,
    nominalBelum: 0,
    jumlahSudah: 0,
    nominalSudah: 0,
    jumlahTunai: 0,
    nominalTunai: 0,
    jumlahTransfer: 0,
    nominalTransfer: 0,
  };
}

/** Tagihan per paket: belum bayar, sudah bayar, lalu rincian tunai dan transfer. */
export function rekapTunaiTransferPerPaket(
  rows: RekapMetodeSumber[]
): RekapMetodeBaris[] {
  const grouped = new Map<number, RekapMetodeBaris>();

  for (const row of rows) {
    if (row.status !== "Terbayar" && row.status !== "Belum") continue;

    let entry = grouped.get(row.paket.id);
    if (!entry) {
      entry = emptyBaris(row.paket);
      grouped.set(row.paket.id, entry);
    }

    if (row.status === "Belum") {
      entry.jumlahBelum += 1;
      entry.nominalBelum += row.total;
      continue;
    }

    entry.jumlahSudah += 1;
    entry.nominalSudah += row.total;
    if (row.metode === "Cash") {
      entry.jumlahTunai += 1;
      entry.nominalTunai += row.total;
    } else if (row.metode === "Transfer") {
      entry.jumlahTransfer += 1;
      entry.nominalTransfer += row.total;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.harga - b.harga);
}
