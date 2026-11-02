import type { RoleName } from "@prisma/client";

export function canAccessPenagihan(role: RoleName): boolean {
  return role === "Superadmin" || role === "Admin" || role === "Keuangan";
}

/** Petugas nonaktif tidak boleh menerima penugasan baru. */
export function inactiveAssignmentError(aktif: boolean): string | null {
  return aktif ? null : "Petugas ini sudah nonaktif dan tidak bisa menerima penugasan baru.";
}

/** Penugasan yang sama tidak perlu dicatat ulang. */
export function shouldRecordAssignmentChange(
  currentPenagihId: number | null,
  nextPenagihId: number
): boolean {
  return currentPenagihId !== nextPenagihId;
}
