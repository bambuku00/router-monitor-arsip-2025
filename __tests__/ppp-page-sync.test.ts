import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/server-actions/router/ppp/actions", () => ({
  getPPP: vi.fn(),
  revalidatePPP: vi.fn(),
}));

import { getPPP, revalidatePPP } from "@/lib/server-actions/router/ppp/actions";
import {
  claimPppAutoSync,
  clearPppAutoSyncSession,
  refreshPppTableAfterSync,
  releasePppAutoSync,
} from "@/lib/ppp-page-sync";

describe("ppp auto sync guard", () => {
  beforeEach(() => {
    clearPppAutoSyncSession(42);
    vi.clearAllMocks();
  });

  it("allows only one in-flight auto sync per router", () => {
    expect(claimPppAutoSync(42)).toBe(true);
    expect(claimPppAutoSync(42)).toBe(false);
    releasePppAutoSync(42, "success");
    expect(claimPppAutoSync(42)).toBe(false);
  });

  it("allows auto sync again only after the session is cleared", () => {
    expect(claimPppAutoSync(42)).toBe(true);
    releasePppAutoSync(42, "success");
    clearPppAutoSyncSession(42);
    expect(claimPppAutoSync(42)).toBe(true);
  });

  it("allows retry claim after error outcome", () => {
    expect(claimPppAutoSync(42)).toBe(true);
    releasePppAutoSync(42, "error");
    expect(claimPppAutoSync(42)).toBe(true);
  });
});

describe("refreshPppTableAfterSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(revalidatePPP).mockResolvedValue({ ok: true as const });
  });

  it("refetches PPP rows from getPPP after revalidate", async () => {
    vi.mocked(getPPP).mockResolvedValue({
      data: [{ id: 1, name: "user1" } as never],
      syncTime: {
        id: 1,
        routerId: 5,
        updated: new Date("2026-01-01"),
        lastSyncStartedAt: null,
        lastSyncCompletedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        lastSyncSecrets: null,
        lastSyncActives: null,
        syncInProgress: false,
      },
      totalTagih: { harga: 100, ppn: 11, total: 111 },
      packageChangeQuota: null,
    });

    const result = await refreshPppTableAfterSync(5, "auto");

    expect(revalidatePPP).toHaveBeenCalledTimes(1);
    expect(getPPP).toHaveBeenCalledWith(5);
    expect(result.data).toHaveLength(1);
    expect(result.syncTime?.routerId).toBe(5);
  });

  it("throws on getPPP error without AUTH mapping", async () => {
    vi.mocked(getPPP).mockResolvedValue({ error: "Router tidak ditemukan" });

    await expect(refreshPppTableAfterSync(5, "manual")).rejects.toThrow(
      "Router tidak ditemukan"
    );
  });
});
