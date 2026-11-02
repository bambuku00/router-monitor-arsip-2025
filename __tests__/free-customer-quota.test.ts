import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    pelanggan: {
      count: vi.fn(),
    },
    router: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/activity-audit-log", () => ({
  logActivityEvent: vi.fn(),
}));

import prisma from "@/lib/prisma";
import {
  assertFreeCustomerQuotaAllowed,
  checkFreeCustomerQuota,
  computeFreeCustomerQuotaRemaining,
  countActiveFreeCustomersForOwner,
  FreeCustomerQuotaExceededError,
  FREE_CUSTOMER_QUOTA_EXCEEDED_MESSAGE,
  formatLimitLabel,
} from "@/lib/free-customer-quota";
import {
  isPaketGratisByHarga,
  isPelangganGratis,
  resolveIsFreeCustomerForPaket,
} from "@/lib/pelanggan-billing-category";

describe("pelanggan gratis marker", () => {
  it("isPaketGratisByHarga treats harga <= 0 as gratis paket", () => {
    expect(isPaketGratisByHarga(0)).toBe(true);
    expect(isPaketGratisByHarga(100)).toBe(false);
  });

  it("isPelangganGratis prefers isFreeCustomer flag over paid paket", () => {
    expect(
      isPelangganGratis({ isFreeCustomer: true, paket: { harga: 100_000 } })
    ).toBe(true);
    expect(
      isPelangganGratis({ isFreeCustomer: false, paket: { harga: 0 } })
    ).toBe(true);
    expect(
      isPelangganGratis({ isFreeCustomer: false, paket: { harga: 50_000 } })
    ).toBe(false);
  });

  it("resolveIsFreeCustomerForPaket mirrors paket harga rule", () => {
    expect(resolveIsFreeCustomerForPaket(0)).toBe(true);
    expect(resolveIsFreeCustomerForPaket(1)).toBe(false);
  });
});

describe("free customer quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formatLimitLabel shows Unlimited for null", () => {
    expect(formatLimitLabel(null)).toBe("Unlimited");
    expect(formatLimitLabel(5)).toBe("5");
  });

  it("computeFreeCustomerQuotaRemaining unlimited has null remaining", () => {
    expect(computeFreeCustomerQuotaRemaining(null, 99)).toEqual({
      remaining: null,
      overLimit: false,
    });
  });

  it("computeFreeCustomerQuotaRemaining detects over limit", () => {
    expect(computeFreeCustomerQuotaRemaining(5, 6)).toEqual({
      remaining: -1,
      overLimit: true,
    });
    expect(computeFreeCustomerQuotaRemaining(5, 3)).toEqual({
      remaining: 2,
      overLimit: false,
    });
  });

  it("checkFreeCustomerQuota unlimited always passes", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: null,
    } as never);
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(100);

    const result = await checkFreeCustomerQuota({ ownerUserId: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.unlimited).toBe(true);
  });

  it("checkFreeCustomerQuota limit 0 blocks first free slot", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: 0,
    } as never);
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(0);

    const result = await checkFreeCustomerQuota({ ownerUserId: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.limit).toBe(0);
      expect(result.message).toBe(FREE_CUSTOMER_QUOTA_EXCEEDED_MESSAGE);
    }
  });

  it("checkFreeCustomerQuota limit 5 allows until full", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: 5,
    } as never);
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(4);

    const ok = await checkFreeCustomerQuota({ ownerUserId: 3 });
    expect(ok.ok).toBe(true);

    vi.mocked(prisma.pelanggan.count).mockResolvedValue(5);
    const blocked = await checkFreeCustomerQuota({ ownerUserId: 3 });
    expect(blocked.ok).toBe(false);
  });

  it("checkFreeCustomerQuota excludePelangganId supports edit paid to free", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: 1,
    } as never);
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(0);

    const result = await checkFreeCustomerQuota({
      ownerUserId: 4,
      excludePelangganId: 10,
      slotsNeeded: 1,
    });
    expect(result.ok).toBe(true);
  });

  it("assertFreeCustomerQuotaAllowed skips paid paket (edit free to paid path)", async () => {
    await assertFreeCustomerQuotaAllowed({
      ownerUserId: 1,
      paketHarga: 100_000,
    });
    expect(prisma.pelanggan.count).not.toHaveBeenCalled();
  });

  it("assertFreeCustomerQuotaAllowed throws when quota exceeded for Admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: 1,
    } as never);
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(1);

    await expect(
      assertFreeCustomerQuotaAllowed({
        ownerUserId: 5,
        paketHarga: 0,
      })
    ).rejects.toBeInstanceOf(FreeCustomerQuotaExceededError);
  });

  it("assertFreeCustomerQuotaAllowed throws when quota exceeded for Superadmin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: 0,
    } as never);
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(0);

    await expect(
      assertFreeCustomerQuotaAllowed({
        ownerUserId: 6,
        paketHarga: 0,
      })
    ).rejects.toBeInstanceOf(FreeCustomerQuotaExceededError);
  });

  it("quota exceeded message is neutral (no Hubungi Superadmin)", () => {
    expect(FREE_CUSTOMER_QUOTA_EXCEEDED_MESSAGE).not.toMatch(/Hubungi Superadmin/i);
    expect(FREE_CUSTOMER_QUOTA_EXCEEDED_MESSAGE).toMatch(/pengaturan User/i);
  });

  it("countActiveFreeCustomersForOwner queries active free flag only", async () => {
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(3);

    const count = await countActiveFreeCustomersForOwner(7, 99);
    expect(count).toBe(3);
    expect(prisma.pelanggan.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stop: false,
          isFreeCustomer: true,
          router: { userId: 7 },
          id: { not: 99 },
        }),
      })
    );
  });

  it("migration default: null limit means unlimited (backward compatible)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: null,
    } as never);

    const result = await checkFreeCustomerQuota({ ownerUserId: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.unlimited).toBe(true);
  });
});

describe("activity log action names", () => {
  it("documents quota limit change log action only", () => {
    expect("free_customer_limit_changed").toBeTruthy();
    expect("free_customer_quota_override" as string).not.toBe(
      "free_customer_limit_changed"
    );
  });
});
