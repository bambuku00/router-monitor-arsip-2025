export type PembukuanTransferRow = {
  id: number;
  nama: string;
  pppoe: string;
  bank: string;
  nominal: number;
  periode: string;
  pemroses: string;
  diprosesPada: string | null;
  /** Waktu diproses mentah, untuk urutan terbaru di atas. */
  processedAt?: string | null;
};

export type LabeledPembukuanTransfer = PembukuanTransferRow & {
  pembayarKey: string;
  /** Hari kalender Jakarta saat diproses, hanya jika masih di periode halaman. */
  processedDay?: number | null;
};

export type PembukuanTransferBank = {
  bank: string;
  jumlah: number;
  total: number;
};

export function transferBankLabel(input: {
  bankName?: string | null;
  norek?: string | null;
  viaTripay?: boolean;
}): string {
  const name = input.bankName?.trim();
  const norek = input.norek?.trim();
  if (name && norek) return `${name} · ${norek}`;
  if (name) return name;
  if (input.viaTripay) return "Tripay";
  return "Belum dicatat";
}

export type TransferDiprosesSort = "nama" | "tanggal";

function emptyProcessor(label: string): boolean {
  const name = label.trim();
  return name.length === 0 || name === "—";
}

export function sortTransferRows(
  rows: LabeledPembukuanTransfer[],
  sort?: TransferDiprosesSort | null
): LabeledPembukuanTransfer[] {
  return [...rows].sort((a, b) => {
    if (sort === "nama") {
      const aEmpty = emptyProcessor(a.pemroses);
      const bEmpty = emptyProcessor(b.pemroses);
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      const byName = a.pemroses.localeCompare(b.pemroses, "id", {
        sensitivity: "base",
      });
      if (byName !== 0) return byName;
    } else if (sort === "tanggal") {
      const aAt = a.processedAt ? new Date(a.processedAt).getTime() : Number.NaN;
      const bAt = b.processedAt ? new Date(b.processedAt).getTime() : Number.NaN;
      const aMissing = Number.isNaN(aAt);
      const bMissing = Number.isNaN(bAt);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (!aMissing && !bMissing && aAt !== bAt) return bAt - aAt;
    } else {
      const byPeriode = b.periode.localeCompare(a.periode);
      if (byPeriode !== 0) return byPeriode;
    }
    return a.nama.localeCompare(b.nama, "id") || a.id - b.id;
  });
}

export function filterTransferRows(
  rows: LabeledPembukuanTransfer[],
  query: string,
  bank?: string | null,
  processor?: string | null,
  day?: number | null
): LabeledPembukuanTransfer[] {
  const bankName = bank?.trim().toLowerCase();
  const processorName = processor?.trim();
  let scoped = bankName
    ? rows.filter((row) => row.bank.toLowerCase() === bankName)
    : rows;
  if (processorName) {
    scoped = scoped.filter((row) => row.pemroses.trim() === processorName);
  }
  if (day != null) {
    scoped = scoped.filter((row) => row.processedDay === day);
  }
  const needle = query.trim().toLowerCase();
  if (!needle) return scoped;
  return scoped.filter(
    (row) =>
      row.nama.toLowerCase().includes(needle) ||
      row.pppoe.toLowerCase().includes(needle) ||
      row.bank.toLowerCase().includes(needle) ||
      (row.pemroses ?? "").toLowerCase().includes(needle)
  );
}

export function transferProcessorOptions(
  rows: LabeledPembukuanTransfer[]
): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    const name = row.pemroses.trim();
    if (name && name !== "—") names.add(name);
  }
  return [...names].sort((left, right) => left.localeCompare(right, "id"));
}

export function transferProcessedDays(
  rows: LabeledPembukuanTransfer[]
): number[] {
  const days = new Set<number>();
  for (const row of rows) {
    if (row.processedDay != null) days.add(row.processedDay);
  }
  return [...days].sort((left, right) => left - right);
}

export function summarizeTransfers(rows: LabeledPembukuanTransfer[]): {
  banks: PembukuanTransferBank[];
  jumlah: number;
  pembayar: number;
} {
  const byBank = new Map<string, PembukuanTransferBank>();
  const pembayar = new Set<string>();
  for (const row of rows) {
    pembayar.add(row.pembayarKey);
    const current = byBank.get(row.bank) ?? {
      bank: row.bank,
      jumlah: 0,
      total: 0,
    };
    current.jumlah += 1;
    current.total += row.nominal;
    byBank.set(row.bank, current);
  }
  const banks = [...byBank.values()].sort(
    (a, b) => b.total - a.total || a.bank.localeCompare(b.bank, "id")
  );
  return { banks, jumlah: rows.length, pembayar: pembayar.size };
}

export type PembukuanCashOrang = {
  nama: string;
  jumlah: number;
  total: number;
};

/** Orang yang tercatat menerima atau mencatat pembayaran. Kosong jatuh ke nama pelanggan. */
export function namaPelakuCash(row: { pemroses: string; nama: string }): string {
  const proses = row.pemroses.trim();
  if (proses && proses !== "—") return proses;
  const nama = row.nama.trim();
  return nama || "Tidak tercatat";
}

export function summarizeCashOrang(rows: LabeledPembukuanTransfer[]): {
  orang: PembukuanCashOrang[];
  jumlah: number;
  total: number;
} {
  const byName = new Map<string, PembukuanCashOrang>();
  let total = 0;
  for (const row of rows) {
    const nama = namaPelakuCash(row);
    const current = byName.get(nama) ?? { nama, jumlah: 0, total: 0 };
    current.jumlah += 1;
    current.total += row.nominal;
    byName.set(nama, current);
    total += row.nominal;
  }
  const orang = [...byName.values()].sort(
    (a, b) => b.total - a.total || a.nama.localeCompare(b.nama, "id")
  );
  return { orang, jumlah: rows.length, total };
}

export function filterCashRows(
  rows: LabeledPembukuanTransfer[],
  query: string,
  pelaku?: string | null
): LabeledPembukuanTransfer[] {
  const nama = pelaku?.trim();
  const scoped = nama ? rows.filter((row) => namaPelakuCash(row) === nama) : rows;
  const needle = query.trim().toLowerCase();
  if (!needle) return scoped;
  return scoped.filter(
    (row) =>
      row.nama.toLowerCase().includes(needle) ||
      row.pppoe.toLowerCase().includes(needle) ||
      namaPelakuCash(row).toLowerCase().includes(needle)
  );
}

export function paginateTransferRows(
  rows: LabeledPembukuanTransfer[],
  page: number,
  pageSize: number
): {
  rows: PembukuanTransferRow[];
  total: number;
  page: number;
  totalPages: number;
} {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize).map(
      ({ id, nama, pppoe, bank, nominal, periode, pemroses, diprosesPada }) => ({
        id,
        nama,
        pppoe,
        bank,
        nominal,
        periode,
        pemroses,
        diprosesPada,
      })
    ),
    total,
    page: safePage,
    totalPages,
  };
}
