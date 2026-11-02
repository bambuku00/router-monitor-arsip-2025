import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pembayaran-no-invoice", () => ({
  allocateNoInvoiceBatch: vi.fn(async (count: number) =>
    Array.from({ length: count }, (_, index) =>
      String(900001 + index).padStart(6, "0")
    )
  ),
}));

import { allocateNoInvoiceBatch } from "@/lib/pembayaran-no-invoice";
import {
  claimPembayaranLunas,
  payPelangganMonthsAhead,
} from "@/lib/pembayaran-bulan-depan";
import { canBulkMarkPembayaranPelanggan } from "@/lib/staff-permissions";

type Row = {
  id: number;
  pelangganId: number;
  paketId: number;
  jatuh_tempo: string;
  total: number;
  status: "Belum" | "Terbayar";
  bankId: number | null;
  metode: "Cash" | "Transfer" | null;
  inputterId: number | null;
  noInvoice: string;
  bayarSekaligus?: number | null;
};

type Log = {
  pembayaranId: number;
  inputterId: number;
  status: "Belum" | "Terbayar";
  metode: "Cash" | "Transfer" | null;
  total: number;
};

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
    meta: { target: ["pelangganId", "jatuh_tempo"] },
  });
}

function createStore(initial: Row[], options?: { loseClaim?: boolean }) {
  const rows = initial.map((row) => ({ ...row }));
  const logs: Log[] = [];
  let nextId = Math.max(0, ...rows.map((row) => row.id)) + 1;

  const tx = {
    pembayaran: {
      findMany: async () =>
        rows.map((row) => ({
          id: row.id,
          jatuh_tempo: row.jatuh_tempo,
          status: row.status,
          total: row.total,
        })),
      findUnique: async ({ where }: { where: { id: number } }) => {
        const row = rows.find((item) => item.id === where.id);
        return row ? { ...row } : null;
      },
      findFirst: async ({
        where,
      }: {
        where: { pelangganId: number; jatuh_tempo: string };
      }) => {
        const row = rows.find(
          (item) =>
            item.pelangganId === where.pelangganId &&
            item.jatuh_tempo === where.jatuh_tempo
        );
        return row ? { id: row.id, status: row.status } : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: number; status: "Belum" | "Terbayar" };
        data: Partial<Row>;
      }) => {
        const row = rows.find((item) => item.id === where.id);
        if (options?.loseClaim || !row || row.status !== where.status) {
          return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      },
      create: async ({ data }: { data: Omit<Row, "id"> & { id?: number } }) => {
        const exists = rows.some(
          (item) =>
            item.pelangganId === data.pelangganId &&
            item.jatuh_tempo === data.jatuh_tempo
        );
        if (exists) throw uniqueError();
        const row: Row = {
          id: nextId++,
          pelangganId: data.pelangganId,
          paketId: data.paketId,
          jatuh_tempo: data.jatuh_tempo,
          total: data.total,
          status: data.status,
          bankId: data.bankId,
          metode: data.metode,
          inputterId: data.inputterId,
          noInvoice: data.noInvoice,
          bayarSekaligus: data.bayarSekaligus ?? null,
        };
        rows.push(row);
        return { id: row.id, pelangganId: row.pelangganId, total: row.total };
      },
    },
    logBayar: {
      create: async ({ data }: { data: Log }) => {
        logs.push(data);
        return { id: logs.length };
      },
    },
  };

  return {
    rows,
    logs,
    tx: tx as unknown as Prisma.TransactionClient,
  };
}

const source = {
  id: 11,
  pelangganId: 4,
  paketId: 8,
  jatuh_tempo: "2026-10-20",
  total: 100000,
};

describe("claimPembayaranLunas", () => {
  it("mencatat tunai sekali dan mempertahankan nominal", async () => {
    const store = createStore([
      {
        ...source,
        status: "Belum",
        bankId: null,
        metode: null,
        inputterId: null,
        noInvoice: "000011",
      },
    ]);

    const first = await claimPembayaranLunas(store.tx, {
      pembayaranId: source.id,
      metode: "Cash",
      bankId: null,
      inputterId: 19,
    });
    const second = await claimPembayaranLunas(store.tx, {
      pembayaranId: source.id,
      metode: "Transfer",
      bankId: 3,
      inputterId: 19,
    });

    expect(first).toEqual({
      id: 11,
      pelangganId: 4,
      total: 100000,
      logBayarId: 1,
    });
    expect(second).toBeNull();
    expect(store.logs).toEqual([
      {
        pembayaranId: 11,
        inputterId: 19,
        status: "Terbayar",
        metode: "Cash",
        total: 100000,
      },
    ]);
    expect(store.rows[0]).toMatchObject({
      status: "Terbayar",
      metode: "Cash",
      bankId: null,
      total: 100000,
    });
  });

  it("tidak menulis log bila klaim kalah dari permintaan lain", async () => {
    const store = createStore(
      [
        {
          ...source,
          status: "Belum",
          bankId: null,
          metode: null,
          inputterId: null,
          noInvoice: "000011",
        },
      ],
      { loseClaim: true }
    );

    const claimed = await claimPembayaranLunas(store.tx, {
      pembayaranId: source.id,
      metode: "Transfer",
      bankId: 3,
      inputterId: 2,
    });

    expect(claimed).toBeNull();
    expect(store.logs).toHaveLength(0);
    expect(store.rows[0]?.status).toBe("Belum");
  });
});

describe("payPelangganMonthsAhead", () => {
  beforeEach(() => {
    vi.mocked(allocateNoInvoiceBatch).mockClear();
  });

  it("melunasi bulan ini dan membuat bulan depan dengan nominal yang sama", async () => {
    const store = createStore([
      {
        ...source,
        status: "Belum",
        bankId: null,
        metode: null,
        inputterId: null,
        noInvoice: "000011",
      },
    ]);

    const result = await payPelangganMonthsAhead(store.tx, {
      source,
      bulanBayar: 2,
      metode: "Transfer",
      bankId: 5,
      inputterId: 7,
    });

    expect(result.newlyPaid).toBe(2);
    expect(result.primary).toMatchObject({ id: 11, total: 100000 });
    expect(store.logs.map((log) => log.total)).toEqual([100000, 100000]);
    expect(store.logs.map((log) => log.metode)).toEqual(["Transfer", "Transfer"]);
    expect(store.rows.map((row) => row.jatuh_tempo)).toEqual([
      "2026-10-20",
      "2026-11-20",
    ]);
    expect(store.rows.every((row) => row.total === 100000)).toBe(true);
    expect(store.rows.every((row) => row.bayarSekaligus === 2)).toBe(true);
  });

  it("melewati bulan yang sudah lunas tanpa mengubah metode, lalu melunasi bulan berikutnya", async () => {
    const store = createStore([
      {
        ...source,
        status: "Terbayar",
        bankId: 9,
        metode: "Cash",
        inputterId: 1,
        noInvoice: "000011",
      },
      {
        id: 12,
        pelangganId: 4,
        paketId: 8,
        jatuh_tempo: "2026-11-20",
        total: 100000,
        status: "Belum",
        bankId: null,
        metode: null,
        inputterId: null,
        noInvoice: "000012",
      },
    ]);

    const result = await payPelangganMonthsAhead(store.tx, {
      source,
      bulanBayar: 2,
      metode: "Transfer",
      bankId: 5,
      inputterId: 7,
    });

    expect(result.newlyPaid).toBe(1);
    expect(store.logs).toHaveLength(1);
    expect(store.logs[0]).toMatchObject({ pembayaranId: 12, metode: "Transfer" });
    expect(store.rows[0]).toMatchObject({
      status: "Terbayar",
      metode: "Cash",
      bankId: 9,
      inputterId: 1,
    });
    expect(store.rows[0]?.bayarSekaligus ?? null).toBeNull();
    expect(store.rows[1]?.bayarSekaligus).toBe(2);
  });

  it("tidak menambah log bila seluruh bulan yang diminta sudah lunas", async () => {
    const store = createStore([
      {
        ...source,
        status: "Terbayar",
        bankId: 9,
        metode: "Cash",
        inputterId: 1,
        noInvoice: "000011",
      },
    ]);

    const result = await payPelangganMonthsAhead(store.tx, {
      source,
      bulanBayar: 1,
      metode: "Transfer",
      bankId: 5,
      inputterId: 7,
    });

    expect(result.newlyPaid).toBe(0);
    expect(store.logs).toHaveLength(0);
    expect(allocateNoInvoiceBatch).not.toHaveBeenCalled();
    expect(store.rows[0]).toMatchObject({ metode: "Cash", bankId: 9 });
  });
});

describe("canBulkMarkPembayaranPelanggan", () => {
  it("menolak petugas dan mengizinkan peran yang sebelumnya boleh membayar massal", () => {
    expect(canBulkMarkPembayaranPelanggan(null)).toBe(false);
    expect(canBulkMarkPembayaranPelanggan({ role: "Petugas" })).toBe(false);
    expect(canBulkMarkPembayaranPelanggan({ role: "Admin" })).toBe(true);
    expect(canBulkMarkPembayaranPelanggan({ role: "Superadmin" })).toBe(true);
    expect(canBulkMarkPembayaranPelanggan({ role: "Keuangan" })).toBe(true);
    expect(canBulkMarkPembayaranPelanggan({ role: "Teknisi" })).toBe(true);
  });
});
