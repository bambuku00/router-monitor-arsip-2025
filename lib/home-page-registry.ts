/**
 * Canonical map of every `(home)` page and its server-side authorization rule.
 * Used by audit tests — new private pages must be listed here and gated in page.tsx.
 */
export type HomePageAuthCategory =
  | "login-only-exempt"
  | "menu-permission"
  | "role-restricted"
  | "menu-and-object-scope";

export type HomePageSpec = {
  /** Relative path under `app/(home)/` */
  pagePath: string;
  /** Pathname for `requirePageAccess` / `canAccessPathname` */
  authPathname: string;
  category: HomePageAuthCategory;
  menuKey?: string;
  roleNotes?: string;
  objectScopeNotes?: string;
};

/** Pages exempt from `requirePageAccess` — must still call `guardForbiddenPage` or login check. */
export const HOME_PAGE_AUTH_EXEMPT = new Set(["forbidden/page.tsx"]);

/** Markers that satisfy the page-level authorization audit. */
export const HOME_PAGE_AUTH_MARKERS = [
  "requirePageAccess(",
  "guardHomePage(",
  "guardForbiddenPage(",
] as const;

export const HOME_PAGE_SPECS: HomePageSpec[] = [
  {
    pagePath: "forbidden/page.tsx",
    authPathname: "/forbidden",
    category: "login-only-exempt",
    roleNotes: "Always allowed for logged-in users",
  },
  {
    pagePath: "dashboard/page.tsx",
    authPathname: "/dashboard",
    category: "menu-permission",
    menuKey: "dashboard",
  },
  {
    pagePath: "pembayaran/[id]/page.tsx",
    authPathname: "/pembayaran/{id}",
    category: "menu-and-object-scope",
    menuKey: "pembayaran",
    objectScopeNotes: "canAccessUser(ownerId)",
  },
  {
    pagePath: "pembayaran/mitra/page.tsx",
    authPathname: "/pembayaran/mitra",
    category: "menu-permission",
    menuKey: "pembayaran_mitra",
    roleNotes: "Superadmin only",
  },
  {
    pagePath: "pembayaran/cetak/[id]/page.tsx",
    authPathname: "/pembayaran/{id}",
    category: "menu-and-object-scope",
    menuKey: "pembayaran",
    objectScopeNotes: "canAccessUser(mitraUserId)",
  },
  {
    pagePath: "pembayaran/invoice/[pembayaranId]/page.tsx",
    authPathname: "/pembayaran/invoice/{pembayaranId}",
    category: "menu-and-object-scope",
    menuKey: "pembayaran",
    objectScopeNotes: "getPembayaranInScope(pembayaranId)",
  },
  {
    pagePath: "pembayaran/kuitansi/[pembayaranId]/page.tsx",
    authPathname: "/pembayaran/kuitansi/{pembayaranId}",
    category: "menu-and-object-scope",
    menuKey: "pembayaran",
    objectScopeNotes: "getPembayaranInScope(pembayaranId)",
  },
  {
    pagePath: "pembukuan/page.tsx",
    authPathname: "/pembukuan",
    category: "menu-permission",
    menuKey: "pembukuan",
  },
  {
    pagePath: "pembukuan/[id]/page.tsx",
    authPathname: "/pembukuan",
    category: "menu-and-object-scope",
    menuKey: "pembukuan",
    objectScopeNotes: "mitra staff scoped to parent; canAccessUser for Admin",
  },
  {
    pagePath: "routers/page.tsx",
    authPathname: "/routers",
    category: "menu-permission",
    menuKey: "routers",
  },
  {
    pagePath: "router/[id]/page.tsx",
    authPathname: "/router/{id}",
    category: "menu-and-object-scope",
    menuKey: "routers",
    objectScopeNotes: "resolveRouterIdAccess + deleted:false",
  },
  {
    pagePath: "router/[id]/ppp/page.tsx",
    authPathname: "/router/{id}/ppp",
    category: "menu-and-object-scope",
    menuKey: "pppoe",
    objectScopeNotes: "resolveRouterIdAccess + getPPP",
  },
  {
    pagePath: "paket/page.tsx",
    authPathname: "/paket",
    category: "menu-permission",
    menuKey: "paket",
  },
  {
    pagePath: "users/page.tsx",
    authPathname: "/users",
    category: "menu-permission",
    menuKey: "users",
    roleNotes: "Admin or Superadmin",
  },
  {
    pagePath: "settings/page.tsx",
    authPathname: "/settings",
    category: "menu-permission",
    menuKey: "settings",
  },
  {
    pagePath: "settings/billing/page.tsx",
    authPathname: "/settings/billing",
    category: "role-restricted",
    roleNotes: "Superadmin only",
  },
  {
    pagePath: "settings/invoice/page.tsx",
    authPathname: "/settings/invoice",
    category: "role-restricted",
    roleNotes: "Admin or Superadmin",
  },
  {
    pagePath: "settings/portal/page.tsx",
    authPathname: "/settings/portal",
    category: "role-restricted",
    roleNotes: "Admin or Superadmin",
  },
  {
    pagePath: "settings/tripay/page.tsx",
    authPathname: "/settings/tripay",
    category: "role-restricted",
    roleNotes: "Admin or Superadmin",
  },
  {
    pagePath: "isolir/settings/page.tsx",
    authPathname: "/isolir/settings",
    category: "menu-permission",
    menuKey: "isolir_settings",
  },
  {
    pagePath: "isolir/log/page.tsx",
    authPathname: "/isolir/log",
    category: "menu-permission",
    menuKey: "isolir_log",
  },
  {
    pagePath: "tools/mikrotik/page.tsx",
    authPathname: "/tools/mikrotik",
    category: "menu-permission",
    menuKey: "mikrotik_tools",
  },
  {
    pagePath: "pembaruan/page.tsx",
    authPathname: "/pembaruan",
    category: "role-restricted",
    roleNotes: "Admin or Superadmin",
  },
  {
    pagePath: "billing/generate-log/page.tsx",
    authPathname: "/billing/generate-log",
    category: "role-restricted",
    roleNotes: "Superadmin only",
  },
  {
    pagePath: "tiket/page.tsx",
    authPathname: "/tiket",
    category: "menu-permission",
    menuKey: "pppoe",
    roleNotes: "Staff dengan menu PPPoE. Daftar dibatasi pemilik pelanggan.",
  },
  {
    pagePath: "log/page.tsx",
    authPathname: "/log",
    category: "role-restricted",
    roleNotes: "Admin or Superadmin. Shows existing audit log rows only.",
  },
  {
    pagePath: "petugas/page.tsx",
    authPathname: "/petugas",
    category: "role-restricted",
    roleNotes: "Superadmin, Admin, or Keuangan. Collector assignment, not visit results.",
  },
  {
    pagePath: "petugas/cetak/page.tsx",
    authPathname: "/petugas/cetak",
    category: "role-restricted",
    roleNotes: "Superadmin, Admin, or Keuangan. Read-only unpaid invoice print.",
  },
];

/** Resolve auth pathname template to a concrete path for access checks. */
export function resolveAuthPathname(
  template: string,
  params: Record<string, string> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? "0");
}
