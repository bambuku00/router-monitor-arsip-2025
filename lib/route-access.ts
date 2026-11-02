import type { RoleName } from "@prisma/client";
import { redirect } from "next/navigation";

import { canAccessPembukuan } from "@/lib/pembukuan-scope";
import { canAccessPenagihan } from "@/lib/penagih-rules";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import {
  apiPathRequiresStaffMenuKey,
  hasStaffMenuAccess,
} from "@/lib/staff-menu-access";
import type { StaffMenuKey } from "@/lib/staff-menu-keys";
import {
  hideMikrotikNavigation,
  isMikrotikRelatedPagePath,
} from "@/lib/arsip-nav";

export type RouteAccessUser = {
  id: number;
  role: RoleName;
  parentId?: number | null;
  staffMenuKeys?: unknown;
};

type RouteRule = {
  matches: (pathname: string) => boolean;
  menuKey: StaffMenuKey | null;
  roleAllowed: (user: RouteAccessUser) => boolean;
  landingPath: string | ((user: RouteAccessUser) => string);
};

const STAFF_ROLES: RoleName[] = ["Superadmin", "Admin", "Teknisi", "Keuangan"];

function isStaffRole(role: RoleName): boolean {
  return STAFF_ROLES.includes(role);
}

function canAccessPembayaranPelanggan(user: RouteAccessUser): boolean {
  return (
    user.role === "Superadmin" ||
    user.role === "Admin" ||
    user.role === "Keuangan" ||
    (user.role === "Teknisi" && user.parentId != null) ||
    (user.role === "Petugas" && user.parentId != null)
  );
}

function denyPetugas(user: RouteAccessUser): boolean {
  return user.role !== "Petugas";
}

function canAccessIsolir(user: RouteAccessUser): boolean {
  return (
    user.role === "Superadmin" ||
    user.role === "Admin" ||
    user.role === "Keuangan" ||
    user.role === "Teknisi"
  );
}

function canAccessRouters(user: RouteAccessUser): boolean {
  return isStaffRole(user.role);
}

function canAccessUsers(user: RouteAccessUser): boolean {
  return user.role === "Superadmin" || user.role === "Admin";
}

/** More specific rules must appear before broader prefix matches. */
const ROUTE_RULES: RouteRule[] = [
  {
    matches: (p) => p === "/dashboard" || p.startsWith("/dashboard/"),
    menuKey: "dashboard",
    roleAllowed: denyPetugas,
    landingPath: "/dashboard",
  },
  {
    matches: (p) => p.startsWith("/pembayaran/mitra"),
    menuKey: "pembayaran_mitra",
    roleAllowed: (u) => u.role === "Superadmin",
    landingPath: "/pembayaran/mitra",
  },
  {
    matches: (p) =>
      p.startsWith("/pembayaran") && !p.startsWith("/pembayaran/mitra"),
    menuKey: "pembayaran",
    roleAllowed: canAccessPembayaranPelanggan,
    landingPath: (u) =>
      `/pembayaran/${getOwnedResourcesUserId({
        id: u.id,
        role: u.role,
        parentId: u.parentId ?? undefined,
      })}`,
  },
  {
    matches: (p) => p.startsWith("/pembukuan"),
    menuKey: "pembukuan",
    roleAllowed: (u) =>
      canAccessPembukuan({
        id: u.id,
        role: u.role,
        parentId: u.parentId ?? undefined,
      }),
    landingPath: "/pembukuan",
  },
  {
    matches: (p) => p.startsWith("/isolir/settings"),
    menuKey: "isolir_settings",
    roleAllowed: canAccessIsolir,
    landingPath: "/isolir/settings",
  },
  {
    matches: (p) => p.startsWith("/isolir/log"),
    menuKey: "isolir_log",
    roleAllowed: canAccessIsolir,
    landingPath: "/isolir/log",
  },
  {
    matches: (p) =>
      p.startsWith("/router/") && p.includes("/ppp"),
    menuKey: "pppoe",
    roleAllowed: canAccessRouters,
    landingPath: "/routers",
  },
  {
    matches: (p) =>
      p === "/routers" ||
      (p.startsWith("/router/") && !p.includes("/ppp")),
    menuKey: "routers",
    roleAllowed: canAccessRouters,
    landingPath: "/routers",
  },
  {
    matches: (p) => p.startsWith("/paket"),
    menuKey: "paket",
    roleAllowed: denyPetugas,
    landingPath: "/paket",
  },
  {
    matches: (p) => p.startsWith("/tools/mikrotik"),
    menuKey: "mikrotik_tools",
    roleAllowed: denyPetugas,
    landingPath: "/tools/mikrotik",
  },
  {
    matches: (p) => p.startsWith("/billing/generate-log"),
    menuKey: null,
    roleAllowed: (u) => u.role === "Superadmin",
    landingPath: "/billing/generate-log",
  },
  {
    matches: (p) => p.startsWith("/settings/billing"),
    menuKey: null,
    roleAllowed: (u) => u.role === "Superadmin",
    landingPath: "/settings/billing",
  },
  {
    matches: (p) => p.startsWith("/settings/invoice"),
    menuKey: null,
    roleAllowed: canAccessUsers,
    landingPath: "/settings/invoice",
  },
  {
    matches: (p) => p.startsWith("/settings/portal"),
    menuKey: null,
    roleAllowed: canAccessUsers,
    landingPath: "/settings/portal",
  },
  {
    matches: (p) => p.startsWith("/settings/tripay"),
    menuKey: null,
    roleAllowed: canAccessUsers,
    landingPath: "/settings/tripay",
  },
  {
    matches: (p) => p.startsWith("/settings"),
    menuKey: "settings",
    roleAllowed: denyPetugas,
    landingPath: "/settings",
  },
  {
    matches: (p) => p.startsWith("/users"),
    menuKey: "users",
    roleAllowed: canAccessUsers,
    landingPath: "/users",
  },
  {
    matches: (p) => p.startsWith("/pembaruan"),
    menuKey: null,
    roleAllowed: canAccessUsers,
    landingPath: "/pembaruan",
  },
  {
    matches: (p) => p === "/tiket" || p.startsWith("/tiket/"),
    menuKey: "pppoe",
    roleAllowed: canAccessRouters,
    landingPath: "/tiket",
  },
  {
    matches: (p) => p === "/log" || p.startsWith("/log/"),
    menuKey: null,
    roleAllowed: canAccessUsers,
    landingPath: "/log",
  },
  {
    matches: (p) => p === "/data-penagih" || p.startsWith("/data-penagih/"),
    menuKey: null,
    roleAllowed: (user) => canAccessPenagihan(user.role),
    landingPath: "/data-penagih",
  },
  {
    matches: (p) => p === "/petugas/cetak" || p.startsWith("/petugas/cetak/"),
    menuKey: null,
    roleAllowed: (user) =>
      canAccessPenagihan(user.role) || user.role === "Petugas",
    landingPath: "/petugas/cetak",
  },
  {
    matches: (p) => p === "/petugas" || p.startsWith("/petugas/"),
    menuKey: null,
    roleAllowed: (user) => canAccessPenagihan(user.role),
    landingPath: "/petugas",
  },
];

/** Priority order for post-login and forbidden-page fallback links. */
const LANDING_ROUTE_RULES: RouteRule[] = [
  ROUTE_RULES[0], // dashboard
  ROUTE_RULES[2], // pembayaran pelanggan
  ROUTE_RULES[3], // pembukuan
  ROUTE_RULES[4], // isolir settings
  ROUTE_RULES[5], // isolir log
  ROUTE_RULES[6], // routers (list/detail)
  ROUTE_RULES[7], // pppoe
  ROUTE_RULES[8], // paket
  ROUTE_RULES[9], // mikrotik tools
  ROUTE_RULES[14], // settings (bank)
  ROUTE_RULES[15], // users
  ROUTE_RULES[1], // pembayaran mitra
  ROUTE_RULES[16], // pembaruan
  ROUTE_RULES[10], // billing generate log
];

function normalizePathname(pathname: string): string {
  return pathname.split("?")[0] || pathname;
}

function ruleAllowsUser(rule: RouteRule, user: RouteAccessUser): boolean {
  if (!rule.roleAllowed(user)) return false;
  if (rule.menuKey && !hasStaffMenuAccess(user, rule.menuKey)) return false;
  if (hideMikrotikNavigation()) {
    if (rule.menuKey === "routers" || rule.menuKey === "mikrotik_tools") {
      return false;
    }
    const landing = resolveLandingPath(rule, user);
    if (isMikrotikRelatedPagePath(landing)) return false;
  }
  return true;
}

function resolveLandingPath(rule: RouteRule, user: RouteAccessUser): string {
  return typeof rule.landingPath === "function"
    ? rule.landingPath(user)
    : rule.landingPath;
}

function findMatchingRule(pathname: string): RouteRule | null {
  const p = normalizePathname(pathname);
  for (const rule of ROUTE_RULES) {
    if (rule.matches(p)) return rule;
  }
  return null;
}

/**
 * Returns the first navigable route the user may access, in app priority order,
 * or null when no page is allowed (show forbidden without internal links).
 */
export function getFirstAllowedRoute(user: RouteAccessUser): string | null {
  for (const rule of LANDING_ROUTE_RULES) {
    if (ruleAllowsUser(rule, user)) {
      return resolveLandingPath(rule, user);
    }
  }
  return null;
}

/** Whether the authenticated user may open this page pathname. */
export function canAccessPathname(
  user: RouteAccessUser,
  pathname: string
): boolean {
  const p = normalizePathname(pathname);
  if (p.startsWith("/forbidden")) return true;
  if (hideMikrotikNavigation() && isMikrotikRelatedPagePath(p)) return false;

  const rule = findMatchingRule(p);
  if (!rule) return true;

  return ruleAllowsUser(rule, user);
}

/** Redirect to /forbidden when the user cannot access this page. Call before fetching data. */
export function requirePageAccess(
  user: RouteAccessUser,
  pathname: string
): void {
  if (!canAccessPathname(user, pathname)) {
    redirect("/forbidden");
  }
}

/** Redirect to the first allowed route, or /forbidden when none exist. */
export function redirectToAllowedOrForbidden(user: RouteAccessUser): never {
  redirect(getFirstAllowedRoute(user) ?? "/forbidden");
}

const API_KEY_ROLE_CHECKS: Partial<
  Record<StaffMenuKey, (user: RouteAccessUser) => boolean>
> = {
  pembayaran: canAccessPembayaranPelanggan,
  pembukuan: (u) =>
    canAccessPembukuan({
      id: u.id,
      role: u.role,
      parentId: u.parentId ?? undefined,
    }),
  users: canAccessUsers,
  pembayaran_mitra: (u) => u.role === "Superadmin",
  routers: canAccessRouters,
  pppoe: canAccessRouters,
  isolir_settings: canAccessIsolir,
  isolir_log: canAccessIsolir,
};

/** Whether the authenticated user may call this API pathname. */
export function canAccessApiPath(
  user: RouteAccessUser,
  pathname: string
): boolean {
  if (
    hideMikrotikNavigation() &&
    pathname.startsWith("/api/tools/mikrotik")
  ) {
    return false;
  }

  const key = apiPathRequiresStaffMenuKey(pathname);
  if (!key) return true;
  if (!hasStaffMenuAccess(user, key)) return false;
  const roleCheck = API_KEY_ROLE_CHECKS[key];
  if (roleCheck && !roleCheck(user)) return false;
  return true;
}
