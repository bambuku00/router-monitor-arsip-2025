import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    jobLock: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    router: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    pppSync: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    pppSecret: {
      findMany: vi.fn(),
    },
    pppActive: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/ppp-sync/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ppp-sync/core")>();
  return {
    ...actual,
    loadPppSyncRouter: vi.fn(),
    runFullPppSyncCore: vi.fn(),
    runRealtimePppSyncCore: vi.fn(),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import prisma from "@/lib/prisma";
import {
  isRouterEligibleForBackgroundSync,
  loadPppSyncRouter,
  runFullPppSyncCore,
} from "@/lib/ppp-sync/core";
import { executePppSync } from "@/lib/ppp-sync/execute";
import { runBackgroundPppSyncJob } from "@/lib/jobs/ppp-background-sync";
import { sanitizePppSyncError } from "@/lib/ppp-sync/sanitize-error";

const mockRouter = {
  id: 1,
  deleted: false,
  host: "10.0.0.1",
  port: 8728,
  user: "admin",
  password: "secret",
  userId: 2,
  isolirProfileName: null,
  users: { id: 2, ppn: 11 },
};

describe("ppp background sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizePppSyncError redacts password substrings", () => {
    const out = sanitizePppSyncError("login failed password=abc123 on host");
    expect(out).not.toContain("abc123");
    expect(out).toMatch(/password=\[redacted\]/i);
  });

  it("isRouterEligibleForBackgroundSync skips deleted/incomplete routers", () => {
    expect(isRouterEligibleForBackgroundSync(mockRouter)).toBe(true);
    expect(
      isRouterEligibleForBackgroundSync({ ...mockRouter, deleted: true })
    ).toBe(false);
    expect(
      isRouterEligibleForBackgroundSync({ ...mockRouter, host: "" })
    ).toBe(false);
  });

  it("global lock prevents second background job", async () => {
    vi.mocked(prisma.jobLock.findUnique).mockResolvedValue({
      name: "ppp-background-sync",
      lockedAt: new Date(),
      lockedUntil: new Date(Date.now() + 60_000),
      owner: "other",
    });

    const result = await runBackgroundPppSyncJob();
    expect(result.skippedGlobalLock).toBe(true);
    expect(prisma.router.findMany).not.toHaveBeenCalled();
  });

  it("per-router lock blocks concurrent acquire", async () => {
    vi.mocked(prisma.jobLock.findUnique).mockResolvedValue({
      name: "ppp-sync:router:1",
      lockedAt: new Date(),
      lockedUntil: new Date(Date.now() + 60_000),
      owner: "manual:full:other",
    });

    const { acquireRouterPppSyncLock } = await import("@/lib/ppp-sync/lock");
    const locked = await acquireRouterPppSyncLock(1, "test");
    expect(locked).toBe(false);
  });

  it("background job continues when one router fails", async () => {
    vi.mocked(prisma.jobLock.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.jobLock.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.jobLock.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.router.findMany).mockResolvedValue([
      { ...mockRouter, id: 1 },
      { ...mockRouter, id: 2, host: "10.0.0.2" },
    ] as never);

    vi.mocked(loadPppSyncRouter)
      .mockResolvedValueOnce(mockRouter as never)
      .mockResolvedValueOnce({ ...mockRouter, id: 2 } as never);

    vi.mocked(runFullPppSyncCore)
      .mockResolvedValueOnce({ ok: false, error: "Router tidak terhubung" })
      .mockResolvedValueOnce({
        ok: true,
        addTotal: 0,
        secretsCreated: 0,
        activesCreated: 0,
        secretsUpdated: 1,
        activesUpdated: 1,
        syncTime: { id: 1, routerId: 2, updated: new Date() },
      });

    vi.mocked(prisma.pppSync.upsert).mockResolvedValue({} as never);

    const result = await runBackgroundPppSyncJob();
    expect(result.total).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.success).toBe(1);
  });

  it("releaseNamedJobLock only deletes matching owner", async () => {
    const { releaseNamedJobLock } = await import("@/lib/ppp-sync/lock");
    vi.mocked(prisma.jobLock.findUnique).mockResolvedValue({
      name: "ppp-background-sync",
      lockedAt: new Date(),
      lockedUntil: new Date(Date.now() + 60_000),
      owner: "owner-a",
    });
    await releaseNamedJobLock("ppp-background-sync", "owner-b");
    expect(prisma.jobLock.delete).not.toHaveBeenCalled();

    await releaseNamedJobLock("ppp-background-sync", "owner-a");
    expect(prisma.jobLock.delete).toHaveBeenCalled();
  });

  it("executePppSync releases lock after success", async () => {
    vi.mocked(prisma.jobLock.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        name: "ppp-sync:router:1",
        lockedAt: new Date(),
        lockedUntil: new Date(Date.now() + 60_000),
        owner: "test-owner",
      });
    vi.mocked(prisma.jobLock.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.jobLock.delete).mockResolvedValue({} as never);
    vi.mocked(loadPppSyncRouter).mockResolvedValue(mockRouter as never);
    vi.mocked(runFullPppSyncCore).mockResolvedValue({
      ok: true,
      addTotal: 0,
      secretsCreated: 0,
      activesCreated: 0,
      secretsUpdated: 0,
      activesUpdated: 0,
      syncTime: { id: 1, routerId: 1, updated: new Date() },
    });
    vi.mocked(prisma.pppSync.findUnique).mockResolvedValue({
      id: 1,
      routerId: 1,
      updated: new Date(),
      lastSyncStartedAt: null,
      lastSyncCompletedAt: new Date(),
      lastSyncStatus: "success",
      lastSyncError: null,
      lastSyncSecrets: 0,
      lastSyncActives: 0,
      syncInProgress: false,
    } as never);

    const outcome = await executePppSync({
      routerId: 1,
      mode: "full",
      source: "background",
      actor: "system",
      lockOwner: "test-owner",
    });

    expect(outcome).toHaveProperty("data");
    expect(prisma.jobLock.delete).toHaveBeenCalled();
  });
});
