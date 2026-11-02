import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/prisma";
import {
  bulkFillPelangganFromPpp,
  hasDailyAutoFillRunToday,
  logDailyAutoFillRun,
} from "@/lib/ppp-bulk-fill-pelanggan";
import { logger } from "@/lib/logger";

vi.mock("@/lib/ppp-bulk-fill-pelanggan", () => ({
  bulkFillPelangganFromPpp: vi.fn(),
  formatBulkFillPelangganSummary: vi.fn(() => "summary"),
  hasDailyAutoFillRunToday: vi.fn(),
  logDailyAutoFillRun: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("maybeRunDailyAutoFillAfterPppSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma.router, "findUnique").mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips when router has no owner", async () => {
    vi.mocked(prisma.router.findUnique).mockResolvedValue({
      userId: null,
      users: null,
    } as never);

    const { maybeRunDailyAutoFillAfterPppSync } = await import(
      "@/lib/ppp-auto-fill-daily"
    );
    const result = await maybeRunDailyAutoFillAfterPppSync(1);

    expect(result).toEqual({ status: "skipped_no_owner" });
    expect(hasDailyAutoFillRunToday).not.toHaveBeenCalled();
    expect(bulkFillPelangganFromPpp).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "AUTO_FILL_SKIP",
        routerId: 1,
        reason: "no_owner",
      })
    );
  });

  it("skips when owner pppAutoFillEnabled is false", async () => {
    vi.mocked(prisma.router.findUnique).mockResolvedValue({
      userId: 5,
      users: { pppAutoFillEnabled: false },
    } as never);

    const { maybeRunDailyAutoFillAfterPppSync } = await import(
      "@/lib/ppp-auto-fill-daily"
    );
    const result = await maybeRunDailyAutoFillAfterPppSync(2);

    expect(result).toEqual({ status: "skipped_disabled_for_owner" });
    expect(hasDailyAutoFillRunToday).not.toHaveBeenCalled();
    expect(bulkFillPelangganFromPpp).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "AUTO_FILL_SKIP",
        routerId: 2,
        ownerUserId: 5,
        reason: "disabled_for_owner",
      })
    );
  });

  it("skips when already ran today (after owner enabled check)", async () => {
    vi.mocked(prisma.router.findUnique).mockResolvedValue({
      userId: 5,
      users: { pppAutoFillEnabled: true },
    } as never);
    vi.mocked(hasDailyAutoFillRunToday).mockResolvedValue(true);

    const { maybeRunDailyAutoFillAfterPppSync } = await import(
      "@/lib/ppp-auto-fill-daily"
    );
    const result = await maybeRunDailyAutoFillAfterPppSync(3);

    expect(result).toEqual({ status: "skipped_already_ran" });
    expect(bulkFillPelangganFromPpp).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "AUTO_FILL_SKIP",
        routerId: 3,
        ownerUserId: 5,
        reason: "already_ran_today",
      })
    );
  });

  it("runs bulk fill when owner enabled and not yet ran today", async () => {
    vi.mocked(prisma.router.findUnique).mockResolvedValue({
      userId: 7,
      users: { pppAutoFillEnabled: true },
    } as never);
    vi.mocked(hasDailyAutoFillRunToday).mockResolvedValue(false);
    vi.mocked(bulkFillPelangganFromPpp).mockResolvedValue({
      created: 2,
      linked: 1,
      skips: {},
      skipNames: {},
    } as never);

    const { maybeRunDailyAutoFillAfterPppSync } = await import(
      "@/lib/ppp-auto-fill-daily"
    );
    const result = await maybeRunDailyAutoFillAfterPppSync(4);

    expect(result).toEqual({ status: "completed", summary: "summary" });
    expect(bulkFillPelangganFromPpp).toHaveBeenCalledWith(4, 7, {
      mode: "automatic",
    });
    expect(logDailyAutoFillRun).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "AUTO_FILL_SUCCESS", routerId: 4 })
    );
  });
});

describe("pppAutoFillEnabled schema default", () => {
  it("migration sets default false for existing users", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const sql = await fs.readFile(
      path.join(
        process.cwd(),
        "prisma/migrations/20260724120000_ppp_auto_fill_enabled/migration.sql"
      ),
      "utf8"
    );
    expect(sql).toMatch(/DEFAULT false/i);
  });
});
