import type { User } from "lucia";

import { hasStaffMenuAccess } from "@/lib/staff-menu-access";

const PPP_MENU_DENIED = "Akses menu PPPoE ditolak untuk akun ini.";

/** Gate menu `pppoe` untuk server action / API internal. Admin/Superadmin lewat otomatis. */
export function denyWithoutPppoeMenu(
  user: Pick<User, "role" | "staffMenuKeys"> | null
): string | null {
  if (!user) return "Unauthorized";
  if (!hasStaffMenuAccess(user, "pppoe")) {
    return PPP_MENU_DENIED;
  }
  return null;
}

export { PPP_MENU_DENIED };
