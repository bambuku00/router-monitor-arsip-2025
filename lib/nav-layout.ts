export type NavLayoutMode = "header" | "sidebar";

export const NAV_LAYOUT_STORAGE_KEY = "router-monitor-nav-layout";

export const DEFAULT_NAV_LAYOUT: NavLayoutMode = "header";

export function isNavLayoutMode(value: string | null): value is NavLayoutMode {
  return value === "header" || value === "sidebar";
}

export function readNavLayoutPreference(): NavLayoutMode {
  if (typeof window === "undefined") return DEFAULT_NAV_LAYOUT;
  const stored = localStorage.getItem(NAV_LAYOUT_STORAGE_KEY);
  return isNavLayoutMode(stored) ? stored : DEFAULT_NAV_LAYOUT;
}

export function writeNavLayoutPreference(mode: NavLayoutMode): void {
  localStorage.setItem(NAV_LAYOUT_STORAGE_KEY, mode);
}

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "router-monitor-sidebar-collapsed";

export function readSidebarCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
}

export function writeSidebarCollapsedPreference(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
}
