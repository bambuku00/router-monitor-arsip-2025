import { describe, expect, it } from "vitest";
import type { RoleName } from "@prisma/client";

import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import {
  canAccessPathname,
  getFirstAllowedRoute,
} from "@/lib/route-access";
import { resolvePostLoginPath } from "@/lib/staff-menu-access";

type TestUser = {
  id: number;
  role: RoleName;
  parentId: number | null;
  staffMenuKeys?: unknown;
};

function user(p: TestUser) {
  return p;
}

describe("getFirstAllowedRoute", () => {
  it("returns pembayaran scope for Teknisi mitra without routers permission", () => {
    const u = user({
      id: 5,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: ["pembayaran"],
    });
    expect(getFirstAllowedRoute(u)).toBe("/pembayaran/10");
  });

  it("does not return dashboard for Keuangan without dashboard permission", () => {
    const u = user({
      id: 3,
      role: "Keuangan",
      parentId: null,
      staffMenuKeys: ["pembayaran", "pembukuan"],
    });
    const route = getFirstAllowedRoute(u);
    expect(route).not.toBe("/dashboard");
    expect(route).toMatch(/^\/pembayaran\//);
  });

  it("returns null when whitelist only contains routes blocked by role", () => {
    const u = user({
      id: 7,
      role: "Teknisi",
      parentId: null,
      staffMenuKeys: ["pembayaran", "pembukuan"],
    });
    expect(getFirstAllowedRoute(u)).toBeNull();
  });

  it("lands a petugas on the mitra pembayaran page", () => {
    const u = user({
      id: 9,
      role: "Petugas",
      parentId: 17,
    });
    expect(getFirstAllowedRoute(u)).toBe("/pembayaran/17");
    expect(canAccessPathname(u, "/dashboard")).toBe(false);
    expect(canAccessPathname(u, "/petugas")).toBe(false);
    expect(canAccessPathname(u, "/data-penagih")).toBe(false);
    expect(canAccessPathname(u, "/petugas/cetak")).toBe(true);
    expect(canAccessPathname(u, "/pembayaran/17")).toBe(true);
  });

  it("returns first route in priority order among allowed keys", () => {
    const u = user({
      id: 2,
      role: "Keuangan",
      parentId: null,
      staffMenuKeys: ["routers", "pembayaran", "pembukuan"],
    });
    expect(getFirstAllowedRoute(u)).toBe("/pembayaran/2");
  });
});

describe("canAccessPathname", () => {
  it("denies /routers and router detail for Teknisi without routers menu key", () => {
    const u = user({
      id: 5,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: ["pembayaran"],
    });
    expect(canAccessPathname(u, "/routers")).toBe(false);
    expect(canAccessPathname(u, "/router/1")).toBe(false);
  });

  it("denies /router/[id]/ppp without pppoe key even with routers", () => {
    const u = user({
      id: 5,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: ["routers"],
    });
    expect(canAccessPathname(u, "/router/1/ppp")).toBe(false);
    expect(canAccessPathname(u, "/tiket")).toBe(false);
    expect(canAccessPathname(u, "/router/1")).toBe(true);
  });

  it("allows /forbidden without redirect loop target", () => {
    const u = user({
      id: 1,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: ["pembayaran"],
    });
    expect(canAccessPathname(u, "/forbidden")).toBe(true);
  });

  it("allows Superadmin drill-down to /pembayaran/{mitraId} from routers", () => {
    const u = user({
      id: 1,
      role: "Superadmin",
      parentId: null,
      staffMenuKeys: null,
    });
    expect(canAccessPathname(u, "/pembayaran/2")).toBe(true);
    expect(canAccessPathname(u, "/pembayaran/cetak/2")).toBe(true);
  });
});

describe("resolvePostLoginPath", () => {
  it("does not send Keuangan without dashboard to /dashboard", () => {
    const u = user({
      id: 4,
      role: "Keuangan",
      parentId: null,
      staffMenuKeys: ["pembukuan"],
    });
    expect(resolvePostLoginPath(u)).not.toBe("/dashboard");
    expect(resolvePostLoginPath(u)).toBe("/pembukuan");
  });

  it("sends user with no allowed routes to /forbidden (no loop)", () => {
    const u = user({
      id: 8,
      role: "Teknisi",
      parentId: null,
      staffMenuKeys: ["pembayaran_mitra"],
    });
    expect(resolvePostLoginPath(u)).toBe("/forbidden");
  });
});

describe("staffMenuApiForbidden router API", () => {
  it("returns 403 for Teknisi without routers permission", () => {
    const u = user({
      id: 5,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: ["pembayaran"],
    }) as unknown as import("lucia").User;

    const resp = staffMenuApiForbidden(u, "/api/router");
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
  });

  it("allows Teknisi with routers permission", () => {
    const u = user({
      id: 5,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: ["routers", "pembayaran"],
    }) as unknown as import("lucia").User;

    expect(staffMenuApiForbidden(u, "/api/router")).toBeNull();
  });
});

describe("redirect loop prevention", () => {
  it("user with no routes: forbidden allowed, post-login is /forbidden", () => {
    const u = user({
      id: 9,
      role: "Teknisi",
      parentId: null,
      staffMenuKeys: ["dashboard"],
    });
    expect(getFirstAllowedRoute(u)).toBe("/dashboard");
    expect(canAccessPathname(u, "/forbidden")).toBe(true);

    const blocked = user({
      id: 10,
      role: "Teknisi",
      parentId: null,
      staffMenuKeys: ["pembayaran"],
    });
    expect(getFirstAllowedRoute(blocked)).toBeNull();
    expect(resolvePostLoginPath(blocked)).toBe("/forbidden");
    expect(canAccessPathname(blocked, "/forbidden")).toBe(true);
  });
});
