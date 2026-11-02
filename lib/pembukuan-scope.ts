import type { User } from "lucia";

type PembukuanUser = Pick<User, "id" | "role" | "parentId">;

/** Staff Teknisi/Keuangan di bawah Admin mitra (`parentId` terisi). */
export function isMitraStaff(user: PembukuanUser): boolean {
  return (
    (user.role === "Keuangan" || user.role === "Teknisi") &&
    user.parentId != null
  );
}

/** Pembukuan tagihan mitra → kantor (Superadmin / Keuangan kantor tanpa induk). */
export function usesKantorPembukuanView(user: PembukuanUser): boolean {
  if (user.role === "Superadmin") return true;
  if (user.role === "Keuangan" && user.parentId == null) return true;
  return false;
}

export function canAccessPembukuan(user: PembukuanUser | null): boolean {
  if (!user) return false;
  if (
    user.role === "Superadmin" ||
    user.role === "Admin" ||
    user.role === "Keuangan"
  ) {
    return true;
  }
  return user.role === "Teknisi" && isMitraStaff(user);
}
