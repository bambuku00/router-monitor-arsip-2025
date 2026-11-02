import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RoleName } from "@prisma/client";

vi.mock("@/lib/pembayaran-backfill", () => ({
  createBackfillPembayaranForPelanggan: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/pelanggan-no-layanan", () => ({
  allocateNoLayananForCreate: vi.fn().mockResolvedValue("NL-202607-0001"),
  dateFromPelangganTgl: vi.fn().mockReturnValue(new Date("2026-01-15")),
  isLegacyNoLayanan: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/activity-audit-log", () => ({
  logActivityEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    router: { findUnique: vi.fn() },
    paket: { findMany: vi.fn() },
    pppSecret: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { findFirst: vi.fn() },
    pelanggan: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  AUTO_FILL_NO_PACKAGE_MESSAGE,
  applyCustomerDirectoryToAutoFilled,
  bulkFillPelangganFromPpp,
  createEmptyBulkFillSkips,
  formatBulkFillPelangganSummary,
  hasDailyAutoFillRunToday,
} from "@/lib/ppp-bulk-fill-pelanggan";
import { buildPppCustomerDirectory } from "@/lib/ppp-customer-directory";

const ROUTER_ID = 10;
const MITRA_ID = 99;
const INPUTTER_ID = 1;

const FREE_PAKET = { id: 1, nama: "gratis", harga: 0 };
const PAID_PAKET = { id: 2, nama: "100m", harga: 100_000 };
const PAID_PAKET_B = { id: 3, nama: "200m", harga: 200_000 };

function mockSecret(name: string, profile: string, id = Math.floor(Math.random() * 10000)) {
  return {
    id,
    name,
    comment: null as string | null,
    profile,
    created: new Date("2026-01-01"),
  };
}

function setupBaseMocks(options: {
  pakets?: typeof FREE_PAKET[];
  freeCustomerLimit: number | null;
  inputterRole?: RoleName;
  getActiveFreeCount: () => number;
  onFreePelangganCreated?: () => void;
}) {
  vi.mocked(prisma.router.findUnique).mockResolvedValue({
    id: ROUTER_ID,
    lat: 0,
    lng: 0,
    users: {
      id: MITRA_ID,
      ppn: 11,
      billingStartMode: "NEXT_MONTH",
      billingStartDate: null,
    },
  } as never);

  vi.mocked(prisma.paket.findMany).mockResolvedValue(
    (options.pakets ?? [FREE_PAKET, PAID_PAKET]) as never
  );

  vi.mocked(prisma.user.findUnique).mockImplementation((async (args: unknown) => {
    const id = (args as { where: { id: number } }).where.id;
    if (id === INPUTTER_ID) {
      return {
        id: INPUTTER_ID,
        role: options.inputterRole ?? "Admin",
        user: "staff",
      };
    }
    if (id === MITRA_ID) {
      return { freeCustomerLimit: options.freeCustomerLimit };
    }
    return null;
  }) as never);

  vi.mocked(prisma.pelanggan.findFirst).mockResolvedValue(null as never);

  vi.mocked(prisma.pelanggan.count).mockImplementation((async () =>
    options.getActiveFreeCount()) as never);

  let nextPelangganId = 1000;
  vi.mocked(prisma.pelanggan.create).mockImplementation((async (args: unknown) => {
    const data = (args as { data: { paketId?: number; isFreeCustomer?: boolean } })
      .data;
    expect(data.paketId).toBeDefined();
    expect(data.paketId).not.toBeNull();
    if (data.isFreeCustomer) {
      options.onFreePelangganCreated?.();
    }
    nextPelangganId += 1;
    return { id: nextPelangganId, ...data };
  }) as never);

  vi.mocked(prisma.pelanggan.update).mockImplementation((async (args: unknown) => {
    const data = (args as { data: { paketId?: number; isFreeCustomer?: boolean } })
      .data;
    expect(data.paketId).toBeDefined();
    if (data.isFreeCustomer) {
      options.onFreePelangganCreated?.();
    }
    return { id: 999, ...data };
  }) as never);
}

describe("formatBulkFillPelangganSummary", () => {
  it("12. summary shows skip reasons correctly", () => {
    const skips = createEmptyBulkFillSkips();
    skips.free_customer_quota_exceeded = 2;
    skips.package_profile_mismatch = 3;
    skips.free_package_not_allowed_as_fallback = 1;
    const text = formatBulkFillPelangganSummary({
      created: 2,
      linked: 1,
      failed: 0,
      skips,
      skipNames: {},
      ambiguousPackageNames: ["100M"],
    });
    expect(text).toContain("Berhasil dibuat/ditautkan: 3");
    expect(text).toContain("Dilewati (kuota pelanggan gratis habis): 2");
    expect(text).toContain("Dilewati (profil tidak cocok): 3");
    expect(text).toContain(
      "Dilewati (paket gratis tidak boleh fallback otomatis): 1"
    );
    expect(text).toContain("Nama paket duplikat");
  });
});

describe("bulkFillPelangganFromPpp — paket resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("9. no active paket throws with clear message", async () => {
    setupBaseMocks({ pakets: [], freeCustomerLimit: null, getActiveFreeCount: () => 0 });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("u1", "100m", 1),
    ] as never);

    await expect(
      bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID)
    ).rejects.toThrow(AUTO_FILL_NO_PACKAGE_MESSAGE);
  });

  it("1. exact profile match to paid paket creates pelanggan", async () => {
    setupBaseMocks({
      pakets: [PAID_PAKET, PAID_PAKET_B],
      freeCustomerLimit: null,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "100m", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(1);
    expect(prisma.pelanggan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paketId: PAID_PAKET.id, isFreeCustomer: false }),
      })
    );
  });

  it("2. exact profile match to Rp0 paket with quota", async () => {
    setupBaseMocks({
      pakets: [FREE_PAKET, PAID_PAKET],
      freeCustomerLimit: 10,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "gratis", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(1);
    expect(prisma.pelanggan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isFreeCustomer: true }),
      })
    );
  });

  it("3. single paid paket + profile mismatch uses fallback", async () => {
    setupBaseMocks({
      pakets: [PAID_PAKET],
      freeCustomerLimit: null,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "other-profile", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(1);
    expect(prisma.pelanggan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paketId: PAID_PAKET.id, isFreeCustomer: false }),
      })
    );
  });

  it("4. single Rp0 paket + profile mismatch skips", async () => {
    setupBaseMocks({
      pakets: [FREE_PAKET],
      freeCustomerLimit: null,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "other", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(0);
    expect(result.skips.free_package_not_allowed_as_fallback).toBe(1);
    expect(prisma.pelanggan.create).not.toHaveBeenCalled();
  });

  it("5. multiple pakets + automatic + mismatch skips", async () => {
    setupBaseMocks({
      pakets: [PAID_PAKET, PAID_PAKET_B],
      freeCustomerLimit: null,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "unknown", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(0);
    expect(result.skips.package_profile_mismatch).toBe(1);
    expect(prisma.pelanggan.create).not.toHaveBeenCalled();
  });

  it("6. multiple pakets + manual default uses selected paket", async () => {
    setupBaseMocks({
      pakets: [PAID_PAKET, PAID_PAKET_B],
      freeCustomerLimit: null,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "unknown", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "manual",
      defaultPaketId: PAID_PAKET_B.id,
    });

    expect(result.created).toBe(1);
    expect(prisma.pelanggan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paketId: PAID_PAKET_B.id }),
      })
    );
  });

  it("7. manual default Rp0 still runs free customer quota", async () => {
    setupBaseMocks({
      pakets: [FREE_PAKET, PAID_PAKET],
      freeCustomerLimit: 0,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "unknown", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "manual",
      defaultPaketId: FREE_PAKET.id,
    });

    expect(result.created).toBe(0);
    expect(result.skips.free_customer_quota_exceeded).toBe(1);
    expect(prisma.pelanggan.create).not.toHaveBeenCalled();
  });

  it("8. duplicate paket names → ambiguous skip", async () => {
    setupBaseMocks({
      pakets: [
        { id: 10, nama: "100M", harga: 100_000 },
        { id: 11, nama: "100m", harga: 150_000 },
      ],
      freeCustomerLimit: null,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "100m", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(0);
    expect(result.skips.ambiguous_package_profile).toBe(1);
    expect(result.ambiguousPackageNames.length).toBeGreaterThan(0);
    expect(prisma.pelanggan.create).not.toHaveBeenCalled();
  });

  it("11. automatic single paid fallback never sets isFreeCustomer true", async () => {
    setupBaseMocks({
      pakets: [PAID_PAKET],
      freeCustomerLimit: null,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("user1", "wrong-profile", 1),
    ] as never);

    await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, { mode: "automatic" });

    expect(prisma.pelanggan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isFreeCustomer: false }),
      })
    );
  });

  it("10. never creates pelanggan without paketId", async () => {
    setupBaseMocks({
      pakets: [PAID_PAKET, PAID_PAKET_B],
      freeCustomerLimit: null,
      getActiveFreeCount: () => 0,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("ok", "100m", 1),
      mockSecret("skip", "unknown", 2),
    ] as never);

    await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, { mode: "automatic" });

    expect(prisma.pelanggan.create).toHaveBeenCalledTimes(1);
  });
});

describe("bulkFillPelangganFromPpp — free customer quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips free pelanggan when quota is full (batch continues)", async () => {
    setupBaseMocks({ freeCustomerLimit: 5, getActiveFreeCount: () => 5 });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("blocked1", "gratis", 1),
      mockSecret("blocked2", "gratis", 2),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(0);
    expect(result.skips.free_customer_quota_exceeded).toBe(2);
    expect(prisma.pelanggan.create).not.toHaveBeenCalled();
  });

  it("fills paid paket while skipping free when quota is full", async () => {
    setupBaseMocks({ freeCustomerLimit: 5, getActiveFreeCount: () => 5 });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("paid1", "100m", 1),
      mockSecret("free1", "gratis", 2),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(1);
    expect(result.skips.free_customer_quota_exceeded).toBe(1);
    expect(prisma.pelanggan.create).toHaveBeenCalledTimes(1);
  });

  it("uses router owner for quota checks", async () => {
    setupBaseMocks({
      freeCustomerLimit: 5,
      inputterRole: "Superadmin",
      getActiveFreeCount: () => 5,
    });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("free1", "gratis", 1),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(prisma.pelanggan.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          router: { userId: MITRA_ID },
        }),
      })
    );
    expect(result.skips.free_customer_quota_exceeded).toBe(1);
  });

  it("records duplicate_customer skip", async () => {
    setupBaseMocks({ freeCustomerLimit: null, getActiveFreeCount: () => 0 });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("dup", "100m", 1),
    ] as never);
    vi.mocked(prisma.pelanggan.findFirst).mockResolvedValue({ id: 50 } as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.skips.duplicate_customer).toBe(1);
    expect(prisma.pelanggan.create).not.toHaveBeenCalled();
  });

  it("keeps usernames that only match before @ as separate customers", async () => {
    setupBaseMocks({ freeCustomerLimit: null, getActiveFreeCount: () => 0 });
    vi.mocked(prisma.pppSecret.findMany).mockResolvedValue([
      mockSecret("deo_p@perumjohar", "100m", 1),
      mockSecret("deo_p@kahyangan", "100m", 2),
    ] as never);

    const result = await bulkFillPelangganFromPpp(ROUTER_ID, INPUTTER_ID, {
      mode: "automatic",
    });

    expect(result.created).toBe(2);
    expect(result.skips.duplicate_customer).toBe(0);
    expect(prisma.pelanggan.create).toHaveBeenCalledTimes(2);
  });
});

describe("applyCustomerDirectoryToAutoFilled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("overwrites the PPPoE name on an auto-isi customer", async () => {
    vi.mocked(prisma.pelanggan.findMany).mockResolvedValue([
      {
        id: 7,
        nama: "user@a",
        nomor: "-",
        alamat: "-",
        ppp_secret: { name: "User@A" },
      },
    ] as never);
    vi.mocked(prisma.pelanggan.update).mockResolvedValue({} as never);
    const directory = buildPppCustomerDirectory(
      "pelanggan,username,no_wa,alamat\nNAMA ASLI,user@a,008111,Jl. Mawar"
    );

    const result = await applyCustomerDirectoryToAutoFilled(10, directory);

    expect(result.updated).toBe(1);
    expect(prisma.pelanggan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          routerId: 10,
          autoFilledAt: { not: null },
        }),
      })
    );
    expect(prisma.pelanggan.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        nama: "NAMA ASLI",
        nomor: "08111",
        alamat: "Jl. Mawar",
        autoFilledAt: null,
      },
    });
  });
});

describe("hasDailyAutoFillRunToday", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when audit log exists for today", async () => {
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({ id: BigInt(1) } as never);
    expect(await hasDailyAutoFillRunToday(ROUTER_ID)).toBe(true);
  });

  it("returns false when no log today", async () => {
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);
    expect(await hasDailyAutoFillRunToday(ROUTER_ID)).toBe(false);
  });
});
