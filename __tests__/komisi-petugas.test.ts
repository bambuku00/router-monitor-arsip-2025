import { describe, expect, it } from "vitest";
import { resolvePenagihanOwner } from "@/lib/penagih";
import {
  batalkanKomisiPembayaran,
  catatKomisiPembayaranPetugas,
  hapusKomisiTagihanTidakLunas,
  komisiMasihBerlaku,
  parseKomisiField,
  parseKomisiNominal,
  rekapKomisiPengeluaran,
  petugasKomisiTarget,
  ringkasKomisi,
  type KomisiTx,
} from "@/lib/komisi-petugas";

type Entri = {
  id: number;
  ownerUserId: number;
  penagihId: number;
  actorUserId: number;
  pelangganId: number;
  pembayaranId: number;
  logBayarId: number | null;
  reversesId: number | null;
  nominal: number;
};

function createLedger(options?: {
  aktif?: boolean;
  komisiNominal?: number;
  ownerUserId?: number;
  pelangganOwnerUserId?: number | null;
  assigned?: boolean;
}) {
  const entries: Entri[] = [];
  let nextId = 1;
  const penagih = {
    id: 2,
    userId: 19,
    aktif: options?.aktif ?? true,
    ownerUserId: options?.ownerUserId ?? 17,
    komisiNominal: options?.komisiNominal ?? 5000,
  };
  const pelanggan = {
    router: { userId: options?.pelangganOwnerUserId ?? penagih.ownerUserId },
  };

  const tx = {
    penagihPenugasan: {
      findUnique: async ({ where }: { where: { pelangganId: number } }) => {
        if (options?.assigned === false || where.pelangganId !== 4) return null;
        return {
          penagih: {
            id: penagih.id,
            ownerUserId: penagih.ownerUserId,
            komisiNominal: penagih.komisiNominal,
            aktif: penagih.aktif,
          },
        };
      },
    },
    pelanggan: {
      findUnique: async () => pelanggan,
    },
    komisiPetugasEntri: {
      findUnique: async ({
        where,
      }: {
        where: { logBayarId?: number; reversesId?: number };
      }) => {
        if (where.logBayarId != null) {
          return entries.find((row) => row.logBayarId === where.logBayarId) ?? null;
        }
        if (where.reversesId != null) {
          return entries.find((row) => row.reversesId === where.reversesId) ?? null;
        }
        return null;
      },
      findMany: async ({
        where,
      }: {
        where: { pembayaranId: number; reversesId: null; nominal: { gt: number } };
      }) =>
        entries.filter(
          (row) =>
            row.pembayaranId === where.pembayaranId &&
            row.reversesId == null &&
            row.nominal > where.nominal.gt
        ),
      create: async ({
        data,
      }: {
        data: Omit<Entri, "id" | "logBayarId" | "reversesId"> & {
          logBayarId?: number | null;
          reversesId?: number | null;
        };
      }) => {
        const row: Entri = {
          id: nextId++,
          ownerUserId: data.ownerUserId,
          penagihId: data.penagihId,
          actorUserId: data.actorUserId,
          pelangganId: data.pelangganId,
          pembayaranId: data.pembayaranId,
          logBayarId: data.logBayarId ?? null,
          reversesId: data.reversesId ?? null,
          nominal: data.nominal,
        };
        if (
          row.logBayarId != null &&
          entries.some((item) => item.logBayarId === row.logBayarId)
        ) {
          throw new Error("logBayarId unik");
        }
        if (
          row.reversesId != null &&
          entries.some((item) => item.reversesId === row.reversesId)
        ) {
          throw new Error("reversesId unik");
        }
        entries.push(row);
        return row;
      },
      delete: async ({ where }: { where: { id: number } }) => {
        const index = entries.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error("komisi tidak ditemukan");
        const [row] = entries.splice(index, 1);
        return row;
      },
    },
  };

  return { entries, tx: tx as unknown as KomisiTx };
}

const bayar = {
  actorUserId: 19,
  pembayaranId: 11,
  pelangganId: 4,
  logBayarId: 1,
};

describe("catatKomisiPembayaranPetugas", () => {
  it("menulis satu kredit saat petugas membayar", async () => {
    const store = createLedger();
    const result = await catatKomisiPembayaranPetugas(store.tx, bayar);
    expect(result).toBe("created");
    expect(store.entries).toEqual([
      expect.objectContaining({
        penagihId: 2,
        actorUserId: 19,
        nominal: 5000,
        logBayarId: 1,
        reversesId: null,
      }),
    ]);
    expect(await catatKomisiPembayaranPetugas(store.tx, bayar)).toBe("skip");
    expect(store.entries).toHaveLength(1);
  });

  it("tetap menulis komisi penagih saat admin membayar", async () => {
    const store = createLedger();
    const result = await catatKomisiPembayaranPetugas(store.tx, {
      ...bayar,
      actorUserId: 7,
    });
    expect(result).toBe("created");
    expect(store.entries).toEqual([
      expect.objectContaining({
        penagihId: 2,
        actorUserId: 7,
        nominal: 5000,
      }),
    ]);
  });

  it("tidak menulis komisi bila pelanggan tidak punya penagih", async () => {
    const store = createLedger({ assigned: false });
    const result = await catatKomisiPembayaranPetugas(store.tx, bayar);
    expect(result).toBe("skip");
    expect(store.entries).toHaveLength(0);
  });

  it("dua pembayaran menambah komisi dua kali tarif petugas", async () => {
    const store = createLedger({ komisiNominal: 5000 });
    await catatKomisiPembayaranPetugas(store.tx, bayar);
    await catatKomisiPembayaranPetugas(store.tx, {
      ...bayar,
      pembayaranId: 12,
      logBayarId: 2,
    });
    expect(store.entries.map((row) => row.nominal)).toEqual([5000, 5000]);
    expect(ringkasKomisi(store.entries).saldo).toBe(10000);
  });

  it("tidak menulis ledger positif bila tarif petugas 0", async () => {
    const store = createLedger({ komisiNominal: 0 });
    const result = await catatKomisiPembayaranPetugas(store.tx, bayar);
    expect(result).toBe("skip");
    expect(store.entries).toHaveLength(0);
  });

  it("tidak menulis komisi bila penagih nonaktif", async () => {
    const store = createLedger({ aktif: false });
    const result = await catatKomisiPembayaranPetugas(store.tx, bayar);
    expect(result).toBe("skip");
    expect(store.entries).toHaveLength(0);
  });
});

describe("hapusKomisiTagihanTidakLunas", () => {
  it("komisi tetap selama tagihan lunas, termasuk bila admin yang membayar", () => {
    expect(komisiMasihBerlaku("Terbayar")).toBe(true);
    expect(komisiMasihBerlaku("Belum")).toBe(false);
  });

  it("menghapus komisi tagihan yang tidak lunas dan mempertahankan yang lunas", async () => {
    const rows = [
      {
        id: 1,
        nominal: 5000,
        reversesId: null as number | null,
        pembayaran: { status: "Belum" as const, inputterId: null, log: [] },
      },
      {
        id: 2,
        nominal: 5000,
        reversesId: null as number | null,
        pembayaran: { status: "Terbayar" as const, inputterId: 19, log: [] },
      },
      {
        id: 3,
        nominal: 5000,
        reversesId: null as number | null,
        pembayaran: { status: "Terbayar" as const, inputterId: 7, log: [] },
      },
    ];
    const db = {
      komisiPetugasEntri: {
        findMany: async () => rows.filter((row) => row.nominal > 0 && row.reversesId == null),
        findUnique: async () => null,
        delete: async ({ where }: { where: { id: number } }) => {
          const index = rows.findIndex((row) => row.id === where.id);
          const [row] = rows.splice(index, 1);
          return row;
        },
      },
    };
    expect(await hapusKomisiTagihanTidakLunas(db as never)).toBe(1);
    expect(rows.map((row) => row.id)).toEqual([2, 3]);
  });
});

describe("batalkanKomisiPembayaran", () => {
  it("menghapus komisi bayar sehingga total berkurang, tanpa catatan pembatalan", async () => {
    const store = createLedger();
    await catatKomisiPembayaranPetugas(store.tx, bayar);

    expect(await batalkanKomisiPembayaran(store.tx, bayar.pembayaranId)).toBe(1);
    expect(await batalkanKomisiPembayaran(store.tx, bayar.pembayaranId)).toBe(0);

    expect(store.entries).toEqual([]);
    expect(ringkasKomisi(store.entries).saldo).toBe(0);
  });

  it("pembayaran ulang setelah batal menghasilkan komisi baru", async () => {
    const store = createLedger();
    await catatKomisiPembayaranPetugas(store.tx, bayar);
    await batalkanKomisiPembayaran(store.tx, bayar.pembayaranId);
    const again = await catatKomisiPembayaranPetugas(store.tx, {
      ...bayar,
      logBayarId: 8,
    });
    expect(again).toBe("created");
    expect(store.entries.map((row) => row.nominal)).toEqual([5000]);
    expect(ringkasKomisi(store.entries)).toEqual({
      masuk: 5000,
      dibatalkan: 0,
      saldo: 5000,
      transaksi: 1,
    });
  });
});

describe("akses komisi", () => {
  it("menolak petugas yang meminta identitas petugas lain", () => {
    expect(petugasKomisiTarget(19, 20).ok).toBe(false);
    expect(petugasKomisiTarget(19, "20").ok).toBe(false);
    expect(petugasKomisiTarget(19, null).ok).toBe(true);
    expect(petugasKomisiTarget(19, 19).ok).toBe(true);
  });

  it("menolak admin mengubah tarif petugas di luar mitranya", async () => {
    const scope = await resolvePenagihanOwner(
      { id: 17, role: "Admin", parentId: null },
      99
    );
    expect(scope).toEqual({ ok: false, status: 403, error: "Akses ditolak" });
  });

  it("menolak nominal yang bukan bilangan bulat", () => {
    expect(parseKomisiNominal(-1).ok).toBe(false);
    expect(parseKomisiNominal(1.5).ok).toBe(false);
    expect(parseKomisiNominal("abc").ok).toBe(false);
    expect(parseKomisiNominal(0)).toEqual({ ok: true, nominal: 0 });
    expect(parseKomisiNominal("2500")).toEqual({ ok: true, nominal: 2500 });
    expect(
      rekapKomisiPengeluaran([
        { nominal: 5000, created: new Date(2026, 9, 2) },
        { nominal: -5000, created: new Date(2026, 9, 3) },
        { nominal: 5000, created: new Date(2026, 9, 4) },
      ]).total
    ).toBe(5000);
    expect(parseKomisiField("")).toEqual({ ok: true, nominal: 0 });
    expect(parseKomisiField("5000")).toEqual({ ok: true, nominal: 5000 });
  });
});
