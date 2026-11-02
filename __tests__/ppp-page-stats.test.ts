import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    pelanggan: { count: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import {
  buildPppRouterFreeCustomerStats,
  formatFreeCustomerQuotaValue,
  getFreeCustomerQuotaDisplayStatus,
  getPppFreeCustomerQuotaStats,
} from "@/lib/ppp-page-stats";
import { countActiveFreeCustomersForOwner } from "@/lib/free-customer-quota";

describe("ppp page stats — free customer display", () => {
  it("unlimited shows used / infinity", () => {
    const stats = buildPppRouterFreeCustomerStats({ used: 3, limit: null });
    expect(formatFreeCustomerQuotaValue(stats)).toEqual({
      primary: "3 / ∞",
      secondary: "Unlimited",
    });
    expect(stats.status).toBe("unlimited");
  });

  it("numeric limit shows used / limit", () => {
    const stats = buildPppRouterFreeCustomerStats({ used: 3, limit: 5 });
    expect(formatFreeCustomerQuotaValue(stats)).toEqual({ primary: "3 / 5" });
    expect(stats.status).toBe("ok");
  });

  it("limit 0 with no usage is full state", () => {
    const stats = buildPppRouterFreeCustomerStats({ used: 0, limit: 0 });
    expect(stats.status).toBe("full");
  });

  it("quota habis at exact limit", () => {
    const stats = buildPppRouterFreeCustomerStats({ used: 5, limit: 5 });
    expect(stats.status).toBe("full");
    expect(formatFreeCustomerQuotaValue(stats).primary).toBe("5 / 5");
  });

  it("over limit status when used exceeds limit", () => {
    expect(getFreeCustomerQuotaDisplayStatus({ used: 8, limit: 5 })).toBe("over");
    const stats = buildPppRouterFreeCustomerStats({ used: 8, limit: 5 });
    expect(stats.overLimit).toBe(true);
    expect(formatFreeCustomerQuotaValue(stats).primary).toBe("8 / 5");
  });

  it("warning when 80% usage reached", () => {
    expect(getFreeCustomerQuotaDisplayStatus({ used: 4, limit: 5 })).toBe(
      "warning"
    );
  });

  it("warning when only one slot left", () => {
    expect(getFreeCustomerQuotaDisplayStatus({ used: 4, limit: 5 })).toBe(
      "warning"
    );
  });
});

describe("ppp page stats — ownership & counting rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses router owner userId for free quota, not logged-in superadmin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: 5,
    } as never);
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(2);

    const stats = await getPppFreeCustomerQuotaStats(99);

    expect(stats.ownerUserId).toBe(99);
    expect(prisma.pelanggan.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isFreeCustomer: true,
          router: { userId: 99 },
        }),
      })
    );
    expect(stats.used).toBe(2);
    expect(stats.limit).toBe(5);
    expect(stats.status).toBe("ok");
  });

  it("getPppFreeCustomerQuotaStats returns unlimited quota for owner", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      freeCustomerLimit: null,
    } as never);
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(0);

    const stats = await getPppFreeCustomerQuotaStats(7);

    expect(stats.ownerUserId).toBe(7);
    expect(stats.limit).toBe(null);
    expect(stats.status).toBe("unlimited");
    expect(formatFreeCustomerQuotaValue(stats).primary).toBe("0 / ∞");
  });
});

describe("free customer active count rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("countActiveFreeCustomersForOwner excludes stopped pelanggan", async () => {
    vi.mocked(prisma.pelanggan.count).mockResolvedValue(0);
    await countActiveFreeCustomersForOwner(5);
    expect(prisma.pelanggan.count).toHaveBeenCalledWith({
      where: {
        stop: false,
        ppp_secretId: { not: null },
        isFreeCustomer: true,
        router: { userId: 5 },
      },
    });
  });
});
