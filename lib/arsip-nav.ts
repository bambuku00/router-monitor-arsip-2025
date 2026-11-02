import type { StaffMenuKey } from "@/lib/staff-menu-keys";

/** Fork arsip: sembunyikan navigasi MikroTik (Router, PPPoE, Mikrotik Tools). */
export function hideMikrotikNavigation(): boolean {
  return process.env.NEXT_PUBLIC_ARSIP_HIDE_MIKROTIK_NAV !== "false";
}

const ARSIP_HIDDEN_STAFF_MENU_KEYS: StaffMenuKey[] = [
  "routers",
  "pppoe",
  "mikrotik_tools",
];

export function isStaffMenuKeyHiddenInArsip(key: StaffMenuKey): boolean {
  return (
    hideMikrotikNavigation() && ARSIP_HIDDEN_STAFF_MENU_KEYS.includes(key)
  );
}

export function isMikrotikRelatedPagePath(pathname: string): boolean {
  const p = pathname.split("?")[0] || pathname;
  if (p.startsWith("/tools/mikrotik")) return true;
  if (p === "/routers") return true;
  if (p.startsWith("/router/")) return true;
  return false;
}
