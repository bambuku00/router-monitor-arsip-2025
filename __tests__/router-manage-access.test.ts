import { describe, expect, it } from "vitest";
import type { RoleName } from "@prisma/client";

import {
  canManageRouter,
  canManageRouterConfig,
  canViewRouter,
  routerListPrismaSelect,
  routerManageApiForbidden,
} from "@/lib/router-manage-access";

function actor(
  role: RoleName,
  id: number,
  parentId: number | null = null
) {
  return { id, role, parentId };
}

describe("canManageRouterConfig", () => {
  it("allows Superadmin and Admin only", () => {
    expect(canManageRouterConfig(actor("Superadmin", 1))).toBe(true);
    expect(canManageRouterConfig(actor("Admin", 10))).toBe(true);
    expect(canManageRouterConfig(actor("Teknisi", 5, 10))).toBe(false);
    expect(canManageRouterConfig(actor("Keuangan", 6, 10))).toBe(false);
  });
});

describe("canManageRouter scope", () => {
  const admin = actor("Admin", 10);
  const teknisi = actor("Teknisi", 5, 10);

  it("Admin manages own-scope router", () => {
    expect(canManageRouter(admin, { userId: 10 })).toBe(true);
  });

  it("Admin denied for other tenant router", () => {
    expect(canManageRouter(admin, { userId: 99 })).toBe(false);
  });

  it("Teknisi never manages router", () => {
    expect(canManageRouter(teknisi, { userId: 10 })).toBe(false);
  });

  it("Superadmin manages any router", () => {
    expect(canManageRouter(actor("Superadmin", 1), { userId: 99 })).toBe(true);
  });
});

describe("canViewRouter", () => {
  it("Teknisi mitra can view parent-scope router", () => {
    expect(
      canViewRouter(actor("Teknisi", 5, 10), { userId: 10 })
    ).toBe(true);
  });

  it("Teknisi cannot view unrelated router", () => {
    expect(
      canViewRouter(actor("Teknisi", 5, 10), { userId: 99 })
    ).toBe(false);
  });
});

describe("routerManageApiForbidden", () => {
  it("returns 403 for Teknisi with routers menu", () => {
    const u = {
      id: 5,
      role: "Teknisi" as const,
      parentId: 10,
      staffMenuKeys: ["routers"],
    } as import("lucia").User;

    const resp = routerManageApiForbidden(u);
    expect(resp?.status).toBe(403);
  });

  it("allows Admin", () => {
    const u = {
      id: 10,
      role: "Admin" as const,
      parentId: null,
    } as unknown as import("lucia").User;

    expect(routerManageApiForbidden(u)).toBeNull();
  });
});

describe("routerListPrismaSelect", () => {
  it("excludes RouterOS credential fields for Teknisi/Keuangan", () => {
    const teknisiSelect = routerListPrismaSelect("Teknisi");
    expect(teknisiSelect).not.toHaveProperty("user");
    expect(teknisiSelect).not.toHaveProperty("userId");
    expect(teknisiSelect).toHaveProperty("host");
  });

  it("includes manager fields for Admin", () => {
    const adminSelect = routerListPrismaSelect("Admin");
    expect(adminSelect).toHaveProperty("user");
    expect(adminSelect).toHaveProperty("userId");
  });
});
