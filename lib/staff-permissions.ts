import type { User } from "lucia";

type StaffPermissionUser = Pick<User, "role"> & {
  staffAllowBankPayment?: boolean | null;
  staffAllowIsolir?: boolean | null;
  staffAllowCancelPayment?: boolean | null;
  staffAllowBerhenti?: boolean | null;
};

/** Bayar massal. Petugas lapangan hanya mencatat satu tagihan. Peran lain tetap lewat akses menu. */
export function canBulkMarkPembayaranPelanggan(
  user: StaffPermissionUser | null
): boolean {
  if (!user) return false;
  return user.role !== "Petugas";
}

/** Staff Teknisi/Keuangan: hanya boleh batalkan jika `staffAllowCancelPayment` aktif. */
export function canCancelPembayaranPelanggan(
  user: StaffPermissionUser | null
): boolean {
  if (!user) return false;
  if (user.role === "Petugas") return false;
  if (user.role === "Teknisi" || user.role === "Keuangan") {
    return user.staffAllowCancelPayment === true;
  }
  return true;
}

/** Staff Teknisi/Keuangan: false = hanya Cash; Admin/Superadmin selalu boleh transfer. */
export function canStaffPayViaBank(user: StaffPermissionUser | null): boolean {
  if (!user) return false;
  if (user.role !== "Teknisi" && user.role !== "Keuangan") return true;
  return user.staffAllowBankPayment !== false;
}

/** Staff Teknisi/Keuangan: hanya boleh isolir PPP jika `staffAllowIsolir` aktif. */
export function canStaffManageIsolir(user: StaffPermissionUser | null): boolean {
  if (!user) return false;
  if (user.role === "Petugas") return false;
  if (user.role !== "Teknisi" && user.role !== "Keuangan") return true;
  return user.staffAllowIsolir === true;
}

/** Staff Teknisi/Keuangan: hanya boleh berhenti / aktifkan kembali langganan jika `staffAllowBerhenti` aktif. */
export function canStaffManageBerhenti(
  user: StaffPermissionUser | null
): boolean {
  if (!user) return false;
  if (user.role === "Petugas") return false;
  if (user.role !== "Teknisi" && user.role !== "Keuangan") return true;
  return user.staffAllowBerhenti === true;
}
