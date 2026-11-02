import { describe, expect, it } from "vitest";
import type { RoleName } from "@prisma/client";

import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import {
  isPppApiPath,
  pathnameRequiresStaffMenuKey,
  reconcileStaffMenuKeys,
} from "@/lib/staff-menu-access";
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

describe("Router vs PPPoE permission split", () => {
  const routersOnly = user({
    id: 5,
    role: "Teknisi",
    parentId: 10,
    staffMenuKeys: ["routers"],
  });

  const both = user({
    id: 7,
    role: "Teknisi",
    parentId: 10,
    staffMenuKeys: ["routers", "pppoe"],
  });

  const neither = user({
    id: 8,
    role: "Teknisi",
    parentId: 10,
    staffMenuKeys: ["pembayaran"],
  });

  it("maps page paths to distinct menu keys", () => {
    expect(pathnameRequiresStaffMenuKey("/routers")).toBe("routers");
    expect(pathnameRequiresStaffMenuKey("/router/97")).toBe("routers");
    expect(pathnameRequiresStaffMenuKey("/router/97/ppp")).toBe("pppoe");
  });

  it("routers-only: list and detail allowed, PPP page denied", () => {
    expect(canAccessPathname(routersOnly, "/routers")).toBe(true);
    expect(canAccessPathname(routersOnly, "/router/97")).toBe(true);
    expect(canAccessPathname(routersOnly, "/router/97/ppp")).toBe(false);
  });

  it("pppoe without routers is not a valid saved whitelist state", () => {
    expect(reconcileStaffMenuKeys(["pppoe"])).toEqual([]);
  });

  it("both permissions: PPP page allowed", () => {
    expect(canAccessPathname(both, "/router/97/ppp")).toBe(true);
  });

  it("neither permission: all router routes denied", () => {
    expect(canAccessPathname(neither, "/routers")).toBe(false);
    expect(canAccessPathname(neither, "/router/97")).toBe(false);
    expect(canAccessPathname(neither, "/router/97/ppp")).toBe(false);
  });
});

describe("PPPoE API path classification", () => {
  it("classifies PPP API paths separately from router management", () => {
    expect(isPppApiPath("/api/router/ppp/data/1")).toBe(true);
    expect(isPppApiPath("/api/router/97/ppp/add")).toBe(true);
    expect(isPppApiPath("/api/router/health/1")).toBe(false);
    expect(isPppApiPath("/api/router")).toBe(false);
  });

  it("denies PPP API for routers-only staff", () => {
    const u = user({
      id: 5,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: ["routers"],
    }) as unknown as import("lucia").User;

    expect(staffMenuApiForbidden(u, "/api/router/ppp/data/1")).not.toBeNull();
    expect(staffMenuApiForbidden(u, "/api/router/97/ppp/add")).not.toBeNull();
    expect(staffMenuApiForbidden(u, "/api/router")).toBeNull();
    expect(staffMenuApiForbidden(u, "/api/router/health/1")).toBeNull();
  });

  it("allows PPP API for staff with pppoe key", () => {
    const u = user({
      id: 5,
      role: "Teknisi",
      parentId: 10,
      staffMenuKeys: ["routers", "pppoe"],
    }) as unknown as import("lucia").User;

    expect(staffMenuApiForbidden(u, "/api/router/ppp/data/1")).toBeNull();
  });
});

describe("staff menu dependency reconcile", () => {
  it("removing routers removes pppoe", () => {
    expect(reconcileStaffMenuKeys(["routers", "pppoe", "pembayaran"])).toEqual([
      "routers",
      "pppoe",
      "pembayaran",
    ]);
    expect(reconcileStaffMenuKeys(["pppoe", "pembayaran"])).toEqual([
      "pembayaran",
    ]);
  });
});

describe("page-level auth independent of x-pathname header", () => {
  it("canAccessPathname does not depend on request headers", () => {
    const u = user({
      id: 1,
      role: "Keuangan",
      parentId: null,
      staffMenuKeys: ["routers"],
    });
    expect(canAccessPathname(u, "/router/9/ppp")).toBe(false);
  });
});
