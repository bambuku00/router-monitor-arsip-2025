import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  router: { findMany: vi.fn() },
  autoIsolirSettings: { findUnique: vi.fn() },
  pembayaran: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

import {
  computeAutoIsolirDate,
  getOverdueCustomers,
  isCurrentBillingPeriod,
  isExecuteTimeDue,
  isReadyForAutoIsolir,
  mergeEarliestUnpaidCandidate,
  normalizeExecuteTime,
  unpaidPeriodAlreadyPaid,
} from "@/lib/auto-isolir/overdue";

describe("auto-isolir overdue helpers", () => {
  it("computeAutoIsolirDate: tgl isolir 1 + toleransi 0 → tanggal 1 bulan tagihan", () => {
    expect(computeAutoIsolirDate("2026-08-20", 1, 0)).toBe("2026-08-01");
  });

  it("isReadyForAutoIsolir: tgl isolir 1 aktif mulai tanggal 1", () => {
    expect(isReadyForAutoIsolir("2026-08-20", 1, 0, "2026-07-31")).toBe(false);
    expect(isReadyForAutoIsolir("2026-08-20", 1, 0, "2026-08-01")).toBe(true);
  });

  it("unpaidPeriodAlreadyPaid: lewati Belum jika bulan yang sama sudah Terbayar", () => {
    const paid = new Set(["2026-08"]);
    expect(unpaidPeriodAlreadyPaid("2026-08-01", paid)).toBe(true);
    expect(unpaidPeriodAlreadyPaid("2026-08-20", paid)).toBe(true);
    expect(unpaidPeriodAlreadyPaid("2026-07-20", paid)).toBe(false);
  });

  it("isExecuteTimeDue: cocokkan jam WIB dari pengaturan", () => {
    const at810 = new Date("2026-08-24T01:10:00.000Z"); // 08:10 WIB
    expect(isExecuteTimeDue("08:10", at810)).toBe(true);
    expect(isExecuteTimeDue("00:10", at810)).toBe(false);
    expect(normalizeExecuteTime("8:10")).toBe("08:10");
  });

  it("isCurrentBillingPeriod: hanya bulan kalender berjalan", () => {
    expect(isCurrentBillingPeriod("2026-08-20", "2026-08-24")).toBe(true);
    expect(isCurrentBillingPeriod("2026-07-20", "2026-08-24")).toBe(false);
  });

  it("mergeEarliestUnpaidCandidate: pilih tagihan Belum terlama", () => {
    const older = { jatuh_tempo: "2026-06-20", id: 1 };
    const newer = { jatuh_tempo: "2026-08-20", id: 2 };
    expect(mergeEarliestUnpaidCandidate(older, newer)).toEqual(older);
    expect(mergeEarliestUnpaidCandidate(newer, older)).toEqual(older);
  });
});

describe("getOverdueCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.autoIsolirSettings.findUnique.mockResolvedValue({
      toleranceDays: 0,
      onlyActiveCustomers: false,
      isolirProfileName: "ISOLIR",
    });
    prismaMock.router.findMany.mockResolvedValue([
      { id: 40, nama: "Router A", isolirProfileName: "ISOLIR" },
    ]);
  });

  function pelanggan(id: number) {
    return {
      id,
      nama: `Pelanggan ${id}`,
      routerId: 40,
      tgl_isolir: 1,
      ppp_secret: {
        name: `ppp-${id}`,
        profile: "10M",
        on_router: true,
        isIsolir: false,
        active_records: null,
      },
    };
  }

  it("skip pelanggan yang bulan tagihannya sudah Terbayar meski ada Belum duplikat", async () => {
    prismaMock.pembayaran.findMany
      .mockResolvedValueOnce([
        {
          id: 101,
          pelangganId: 10,
          jatuh_tempo: "2026-08-01",
          total: 150000,
          pelanggan: pelanggan(10),
        },
      ])
      .mockResolvedValueOnce([
        { pelangganId: 10, jatuh_tempo: "2026-08-20" },
      ]);

    const result = await getOverdueCustomers(1, { todayStr: "2026-08-01" });
    expect(result).toEqual([]);
  });

  it("tetap isolir jika hanya ada tagihan Belum bulan tersebut", async () => {
    prismaMock.pembayaran.findMany
      .mockResolvedValueOnce([
        {
          id: 102,
          pelangganId: 11,
          jatuh_tempo: "2026-08-20",
          total: 150000,
          pelanggan: pelanggan(11),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getOverdueCustomers(1, { todayStr: "2026-08-01" });
    expect(result).toHaveLength(1);
    expect(result[0]?.pelangganId).toBe(11);
    expect(result[0]?.pembayaranId).toBe(102);
  });

  it("skip tunggakan lama jika bulan berjalan sudah Terbayar (kasus SUSI)", async () => {
    prismaMock.pembayaran.findMany
      .mockResolvedValueOnce([
        {
          id: 201,
          pelangganId: 12,
          jatuh_tempo: "2026-07-20",
          total: 150000,
          pelanggan: pelanggan(12),
        },
      ])
      .mockResolvedValueOnce([
        { pelangganId: 12, jatuh_tempo: "2026-08-20" },
      ]);

    const result = await getOverdueCustomers(1, { todayStr: "2026-08-24" });
    expect(result).toEqual([]);
  });
});
