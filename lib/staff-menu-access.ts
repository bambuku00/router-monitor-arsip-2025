import { Prisma, type RoleName } from "@prisma/client";
import { getFirstAllowedRoute } from "@/lib/route-access";
import {
  STAFF_MENU_KEYS,
  type StaffMenuKey,
} from "@/lib/staff-menu-keys";

export { getFirstAllowedRoute } from "@/lib/route-access";

type StaffMenuUser = {
  role: RoleName;
  staffMenuKeys?: unknown;
};

/** Nilai untuk kolom Json Prisma: null DB = tidak dibatasi; array = whitelist. */
export function staffMenuKeysToPrismaJson(
  whitelist: StaffMenuKey[] | null
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return whitelist === null ? Prisma.DbNull : whitelist;
}

/** Normalisasi JSON DB → whitelist atau null (= akses penuh sesuai peran). */
export function normalizeStaffMenuWhitelist(raw: unknown): StaffMenuKey[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const filtered = raw.filter(
    (k): k is StaffMenuKey =>
      typeof k === "string" &&
      (STAFF_MENU_KEYS as readonly string[]).includes(k)
  );
  if (filtered.length === 0) return null;
  return filtered;
}

export function hasStaffMenuAccess(
  user: StaffMenuUser | null,
  key: StaffMenuKey
): boolean {
  if (!user) return false;
  if (user.role !== "Teknisi" && user.role !== "Keuangan") return true;
  const whitelist = normalizeStaffMenuWhitelist(user.staffMenuKeys);
  if (whitelist === null) return true;
  return whitelist.includes(key);
}

/**
 * Normalisasi whitelist saat simpan: PPPoE bergantung pada Router.
 * Menghapus Router otomatis menghapus PPPoE (tidak memperluas akses PPP ke akun lama).
 */
export function reconcileStaffMenuKeys(keys: StaffMenuKey[]): StaffMenuKey[] {
  const set = new Set(keys);
  if (!set.has("routers")) {
    set.delete("pppoe");
  }
  return STAFF_MENU_KEYS.filter((k) => set.has(k));
}

/** PPPoE hanya valid bila Router juga diizinkan (untuk validasi UI). */
export function canEnablePppoeMenuKey(selected: StaffMenuKey[]): boolean {
  return selected.includes("routers");
}

/** Baca daftar rekening mitra: menu Pengaturan (bank) atau Pembayaran (pilih rekening saat transfer). */
export function canListMitraBanks(user: StaffMenuUser | null): boolean {
  if (!user) return false;
  if (user.role !== "Teknisi" && user.role !== "Keuangan") return true;
  return (
    hasStaffMenuAccess(user, "settings") || hasStaffMenuAccess(user, "pembayaran")
  );
}

type StaffWhitelistLandingUser = StaffMenuUser & {
  id: number;
  parentId?: number | null;
};

/**
 * Halaman pertama yang aman dibuka setelah login jika Teknisi/Keuangan punya whitelist.
 * Mengembalikan null jika tidak dibatasi (biarkan pemanggil pakai getFirstAllowedRoute).
 */
export function getStaffWhitelistLandingPath(
  user: StaffWhitelistLandingUser
): string | null {
  if (user.role !== "Teknisi" && user.role !== "Keuangan") return null;
  const wl = normalizeStaffMenuWhitelist(user.staffMenuKeys);
  if (wl === null) return null;
  return getFirstAllowedRoute(user) ?? "/forbidden";
}

/** Halaman tujuan setelah login berhasil. */
export function resolvePostLoginPath(user: StaffWhitelistLandingUser): string {
  return getFirstAllowedRoute(user) ?? "/forbidden";
}

/** pathname dari middleware header `x-pathname` (tanpa query). */
export function pathnameRequiresStaffMenuKey(
  pathname: string
): StaffMenuKey | null {
  const p = pathname.split("?")[0] || pathname;
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return "dashboard";
  if (p.startsWith("/isolir/settings")) return "isolir_settings";
  if (p.startsWith("/isolir/log")) return "isolir_log";
  if (p.startsWith("/pembayaran/mitra")) return "pembayaran_mitra";
  if (p.startsWith("/pembayaran")) return "pembayaran";
  if (p.startsWith("/router/") && p.includes("/ppp")) return "pppoe";
  if (p === "/routers" || p.startsWith("/router/")) return "routers";
  if (p.startsWith("/paket")) return "paket";
  if (p.startsWith("/pembukuan")) return "pembukuan";
  if (p.startsWith("/tools/mikrotik")) return "mikrotik_tools";
  if (p.startsWith("/settings")) return "settings";
  if (p.startsWith("/users")) return "users";
  return null;
}

/** Apakah pathname API terkait operasi PPPoE (bukan manajemen router dasar). */
export function isPppApiPath(pathname: string): boolean {
  if (pathname.startsWith("/api/router/ppp")) return true;
  return /^\/api\/router\/\d+\/ppp(\/|$)/.test(pathname);
}

/** pathname dari request.nextUrl.pathname di route handler API. */
export function apiPathRequiresStaffMenuKey(
  pathname: string
): StaffMenuKey | null {
  if (pathname.startsWith("/api/auto-isolir/settings")) return "isolir_settings";
  if (pathname.startsWith("/api/auto-isolir/logs")) return "isolir_log";
  if (pathname.startsWith("/api/auto-isolir/run")) return "isolir_settings";
  if (pathname.startsWith("/api/pembayaran/mitra")) return "pembayaran_mitra";
  if (pathname.startsWith("/api/pembayaran")) return "pembayaran";
  if (isPppApiPath(pathname)) return "pppoe";
  if (pathname.startsWith("/api/router")) return "routers";
  if (pathname.startsWith("/api/paket")) return "paket";
  if (pathname.startsWith("/api/bank")) return "settings";
  if (pathname.startsWith("/api/tools/mikrotik")) return "mikrotik_tools";
  if (pathname.startsWith("/api/user/client")) return null;
  if (pathname.startsWith("/api/user")) return "users";
  if (pathname.startsWith("/api/client")) return null;
  return null;
}

/** Admin induk atau Superadmin boleh mengatur whitelist menu untuk Teknisi/Keuangan. */
export function canEditStaffMenuKeys(
  actor: { role: RoleName; id: number; parentId?: number | null },
  target: { role: RoleName; parentId: number | null }
): boolean {
  if (target.role !== "Teknisi" && target.role !== "Keuangan") return false;
  if (actor.role === "Superadmin") return true;
  if (actor.role === "Admin") {
    const mitraId = actor.parentId ?? actor.id;
    return target.parentId === mitraId;
  }
  return false;
}
