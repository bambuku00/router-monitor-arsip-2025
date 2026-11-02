import { z } from "zod";

/** Kunci menu / area aplikasi (whitelist untuk Teknisi & Keuangan). */
export const STAFF_MENU_KEYS = [
  "dashboard",
  "routers",
  "pppoe",
  "paket",
  "pembayaran",
  "pembukuan",
  "isolir_settings",
  "isolir_log",
  "users",
  "pembayaran_mitra",
  "mikrotik_tools",
  "settings",
] as const;

export type StaffMenuKey = (typeof STAFF_MENU_KEYS)[number];

export const StaffMenuKeySchema = z.enum(STAFF_MENU_KEYS);

/** Label untuk UI (dialog user & dokumentasi). */
export const STAFF_MENU_LABELS: Record<StaffMenuKey, string> = {
  dashboard: "Dashboard",
  routers: "Router",
  pppoe: "PPPoE",
  paket: "Paket",
  pembayaran: "Pembayaran pelanggan",
  pembukuan: "Pembukuan",
  isolir_settings: "Isolir otomatis",
  isolir_log: "Log auto isolir",
  users: "User & Client",
  pembayaran_mitra: "Pembayaran mitra",
  mikrotik_tools: "Mikrotik Tools",
  settings: "Pengaturan (bank)",
};
