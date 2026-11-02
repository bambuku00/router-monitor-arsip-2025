import { describe, expect, it } from "vitest";
import type { RoleName } from "@prisma/client";

import { auditHomePageAuthorization } from "@/lib/home-page-audit";
import {
  HOME_PAGE_SPECS,
  resolveAuthPathname,
} from "@/lib/home-page-registry";
import { canAccessPathname } from "@/lib/route-access";

type TestUser = {
  id: number;
  role: RoleName;
  parentId: number | null;
  staffMenuKeys?: unknown;
};

function user(p: TestUser) {
  return p;
}

describe("home page authorization audit", () => {
  it("all app/(home) pages have page-level auth and registry entries", () => {
    const issues = auditHomePageAuthorization();
    expect(issues).toEqual([]);
  });

  it("registry covers every expected private page", () => {
    expect(HOME_PAGE_SPECS.length).toBeGreaterThanOrEqual(22);
  });
});

describe("private routes without permission are denied (independent of x-pathname)", () => {
  const deniedUser = user({
    id: 5,
    role: "Teknisi",
    parentId: 10,
    staffMenuKeys: ["pembayaran"],
  });

  const protectedPaths = [
    "/dashboard",
    "/routers",
    "/router/1",
    "/router/1/ppp",
    "/paket",
    "/pembukuan",
    "/pembukuan/99",
    "/isolir/settings",
    "/isolir/log",
    "/tools/mikrotik",
    "/settings",
    "/settings/billing",
    "/settings/invoice",
    "/settings/portal",
    "/settings/tripay",
    "/users",
    "/pembaruan",
    "/billing/generate-log",
    "/log",
    "/petugas",
    "/petugas/cetak",
    "/pembayaran/mitra",
  ];

  it.each(protectedPaths)("denies %s for Teknisi without matching menu key", (path) => {
    expect(canAccessPathname(deniedUser, path)).toBe(false);
  });

  it("allows pembayaran scope path for Teknisi with pembayaran key", () => {
    expect(canAccessPathname(deniedUser, "/pembayaran/10")).toBe(true);
    expect(canAccessPathname(deniedUser, "/pembayaran/cetak/10")).toBe(true);
    expect(canAccessPathname(deniedUser, "/pembayaran/invoice/1")).toBe(true);
    expect(canAccessPathname(deniedUser, "/pembayaran/kuitansi/1")).toBe(true);
    expect(canAccessPathname(deniedUser, "/router/1/ppp")).toBe(false);
  });
});

describe("private routes with permission are allowed", () => {
  const allowedUser = user({
    id: 5,
    role: "Teknisi",
    parentId: 10,
    staffMenuKeys: ["pembayaran", "routers", "dashboard"],
  });

  it.each([
    "/dashboard",
    "/routers",
    "/pembayaran/10",
  ])("allows %s when menu keys include required permission", (path) => {
    expect(canAccessPathname(allowedUser, path)).toBe(true);
  });
});

describe("registry auth pathname templates", () => {
  it("resolves dynamic pembayaran paths", () => {
    expect(resolveAuthPathname("/pembayaran/{id}", { id: "42" })).toBe(
      "/pembayaran/42"
    );
  });
});

describe("role-restricted routes", () => {
  it("denies /settings/billing for Admin", () => {
    const admin = user({
      id: 1,
      role: "Admin",
      parentId: null,
      staffMenuKeys: null,
    });
    expect(canAccessPathname(admin, "/settings/billing")).toBe(false);
  });

  it("denies /pembaruan for Teknisi", () => {
    const teknisi = user({
      id: 2,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: null,
    });
    expect(canAccessPathname(teknisi, "/pembaruan")).toBe(false);
  });

  it("allows /settings/invoice for Admin", () => {
    const admin = user({
      id: 1,
      role: "Admin",
      parentId: null,
      staffMenuKeys: null,
    });
    expect(canAccessPathname(admin, "/settings/invoice")).toBe(true);
  });

  it("allows keuangan to open petugas even with a limited menu list", () => {
    const keuangan = user({
      id: 8,
      role: "Keuangan",
      parentId: 10,
      staffMenuKeys: ["pembayaran"],
    });
    expect(canAccessPathname(keuangan, "/petugas")).toBe(true);
    expect(canAccessPathname(keuangan, "/petugas/cetak")).toBe(true);
  });
});
