import { describe, it, expect, vi, beforeEach } from "vitest";

const getOverdueCustomers = vi.fn();
const getAutoIsolirSettings = vi.fn();
const getEnabledMitraUserIds = vi.fn();
const loadRouterCredentials = vi.fn();
const isolateCustomer = vi.fn();

vi.mock("@/lib/auto-isolir/overdue", () => ({
  getEnabledMitraUserIds: (...a: unknown[]) => getEnabledMitraUserIds(...a),
  getJakartaDateString: () => "2026-07-01",
  getOverdueCustomers: (...a: unknown[]) => getOverdueCustomers(...a),
  getAutoIsolirSettings: (...a: unknown[]) => getAutoIsolirSettings(...a),
}));

vi.mock("@/lib/auto-isolir/lock", () => ({
  acquireJobLock: vi.fn().mockResolvedValue(true),
  releaseJobLock: vi.fn().mockResolvedValue(undefined),
  newBatchId: vi.fn().mockReturnValue("batch-test"),
}));

vi.mock("@/lib/ppp-isolir-service", () => ({
  isolateCustomer: (...a: unknown[]) => isolateCustomer(...a),
  loadRouterCredentials: (...a: unknown[]) => loadRouterCredentials(...a),
  restoreCustomer: vi.fn(),
}));

vi.mock("@/lib/ppp-isolir", () => ({
  isPppIsolir: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pppSecret: { findUnique: vi.fn().mockResolvedValue(null) },
    autoIsolirLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { runAutoIsolation } from "@/lib/auto-isolir/run";
import { isStaffPelangganScopedRole } from "@/lib/staff-pelanggan-scope";

function candidate(pelangganId: number) {
  return {
    userId: 1,
    pelangganId,
    pelangganNama: `Pel ${pelangganId}`,
    pembayaranId: pelangganId * 10,
    jatuh_tempo: "2026-06-01",
    total: 100000,
    routerId: 40,
    routerNama: "R1",
    routerIsolirProfile: "ISOLIR",
    pppUsername: `user${pelangganId}`,
    pppProfile: "default",
    isIsolir: false,
    hasActiveSession: false,
    settingsProfile: "ISOLIR",
  };
}

describe("H9: auto-isolir pelanggan scope filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAutoIsolirSettings.mockResolvedValue({
      enabled: true,
      toleranceDays: 1,
      onlyActiveCustomers: true,
      isolirProfileName: "ISOLIR",
    });
    loadRouterCredentials.mockResolvedValue(null); // fail fast, no RouterOS write
  });

  it("without allow list processes all overdue candidates", async () => {
    getOverdueCustomers.mockResolvedValue([
      candidate(10),
      candidate(99),
    ]);

    const result = await runAutoIsolation({
      userId: 1,
      dryRun: true,
      skipLock: true,
      force: true,
    });

    expect(result.processed).toBe(2);
    expect(result.items.map((i) => i.pelangganId).sort()).toEqual([10, 99]);
  });

  it("with allow list only processes assigned pelanggan", async () => {
    getOverdueCustomers.mockResolvedValue([
      candidate(10),
      candidate(99),
      candidate(11),
    ]);

    const result = await runAutoIsolation({
      userId: 1,
      dryRun: true,
      skipLock: true,
      force: true,
      pelangganIdAllowList: [10, 11],
    });

    expect(result.processed).toBe(2);
    expect(result.items.map((i) => i.pelangganId).sort()).toEqual([10, 11]);
    expect(isolateCustomer).not.toHaveBeenCalled(); // dryRun + no router
  });

  it("empty allow list processes nobody", async () => {
    getOverdueCustomers.mockResolvedValue([candidate(10), candidate(99)]);

    const result = await runAutoIsolation({
      userId: 1,
      dryRun: true,
      skipLock: true,
      force: true,
      pelangganIdAllowList: [],
    });

    expect(result.processed).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("Keuangan is a staff-scoped role; Admin is not", () => {
    expect(isStaffPelangganScopedRole("Keuangan")).toBe(true);
    expect(isStaffPelangganScopedRole("Teknisi")).toBe(true);
    expect(isStaffPelangganScopedRole("Admin")).toBe(false);
    expect(isStaffPelangganScopedRole("Superadmin")).toBe(false);
  });
});
