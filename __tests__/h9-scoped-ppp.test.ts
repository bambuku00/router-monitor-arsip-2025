import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "lucia";

const findUnique = vi.fn();
const findFirst = vi.fn();
const scopeFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: (...a: unknown[]) => findUnique(...a) },
    router: {
      findUnique: vi.fn(),
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
    pelanggan: {
      findUnique: vi.fn(async (args: { where: { id: number } }) => {
        if (args.where.id === 10) {
          return {
            id: 10,
            router: { userId: 1 },
          };
        }
        return null;
      }),
      findFirst: vi.fn(async (args: { where: { ppp_secretId: number } }) => {
        if (args.where.ppp_secretId === 100) return { id: 10 };
        return null;
      }),
    },
    staffPelangganScope: {
      findMany: (...a: unknown[]) => scopeFindMany(...a),
    },
  },
}));

import {
  assertScopedStaffMayUseRouterLevelPpp,
  assertStaffMayMutatePppSecret,
} from "@/lib/authz";

function actor(p: {
  id: number;
  role: string;
  parentId: number | null;
}): User {
  return p as unknown as User;
}

beforeEach(() => {
  findUnique.mockReset();
  findFirst.mockReset();
  scopeFindMany.mockReset();
});

describe("H9: scoped staff PPP authorization", () => {
  it("unrestricted staff (no scope rows) may use router-level ops", async () => {
    scopeFindMany.mockResolvedValueOnce([]);
    await expect(
      assertScopedStaffMayUseRouterLevelPpp(
        actor({ id: 5, role: "Teknisi", parentId: 1 })
      )
    ).resolves.toEqual({ ok: true });
  });

  it("restricted staff denied router-level ops", async () => {
    scopeFindMany.mockResolvedValueOnce([{ pelangganId: 10 }]);
    const r = await assertScopedStaffMayUseRouterLevelPpp(
      actor({ id: 5, role: "Teknisi", parentId: 1 })
    );
    expect(r.ok).toBe(false);
  });

  it("Admin is never restricted by pelanggan scope helper", async () => {
    const r = await assertScopedStaffMayUseRouterLevelPpp(
      actor({ id: 1, role: "Admin", parentId: null })
    );
    expect(r).toEqual({ ok: true });
    expect(scopeFindMany).not.toHaveBeenCalled();
  });

  it("restricted staff may mutate PPP linked to in-scope pelanggan", async () => {
    scopeFindMany.mockResolvedValue([{ pelangganId: 10 }]);
    findFirst.mockResolvedValue({ id: 40, userId: 1 }); // getRouterForUser
    // getPelangganInScope path uses pelanggan.findUnique + scope again
    const r = await assertStaffMayMutatePppSecret(
      actor({ id: 5, role: "Teknisi", parentId: 1 }),
      { id: 100, routerId: 40, name: "cust1" }
    );
    expect(r.ok).toBe(true);
  });

  it("restricted staff denied for unlinked PPP secret", async () => {
    scopeFindMany.mockResolvedValue([{ pelangganId: 10 }]);
    findFirst.mockResolvedValue({ id: 40, userId: 1 });
    const r = await assertStaffMayMutatePppSecret(
      actor({ id: 5, role: "Teknisi", parentId: 1 }),
      { id: 999, routerId: 40, name: "orphan" }
    );
    expect(r.ok).toBe(false);
  });
});
