import { User } from "lucia";
import { RoleName } from "@prisma/client";
import prisma from "@/lib/prisma";

type TenantScopedUser = Pick<User, "id" | "role"> & {
  parentId?: number | null;
};

/**
 * ID user mitra pemilik resource operasional (router, paket, bank, pembayaran mitra).
 * Teknisi, Keuangan, dan Admin tambahan (`parentId` = Admin induk) mengelola data induk.
 * Admin induk (`parentId` kosong) tetap pemilik mitra itu sendiri.
 */
export function getOwnedResourcesUserId(user: TenantScopedUser): number {
  if (
    (user.role === "Teknisi" ||
      user.role === "Keuangan" ||
      user.role === "Admin" ||
      user.role === "Petugas") &&
    user.parentId != null
  ) {
    return user.parentId;
  }
  return user.id;
}

/**
 * Checks if a user has a specific role or one of the allowed roles.
 * Superadmin always has access.
 */
export function hasRole(user: User | null, role: RoleName | RoleName[]): boolean {
  if (!user) return false;
  if (user.role === "Superadmin") return true;

  if (Array.isArray(role)) {
    return role.includes(user.role);
  }
  return user.role === role;
}

/**
 * Akses resource yang “dimiliki” user `ownerId` (router, bank mitra, tagihan, dll.).
 * Admin **tidak** lagi punya akses global ke semua tenant.
 */
export function canAccessUser(
  user: TenantScopedUser | null,
  ownerId: number
): boolean {
  if (!user) return false;
  if (user.role === "Superadmin") return true;

  return user.id === ownerId || user.parentId === ownerId; // Owner or Parent can access
}

/**
 * Boleh mutasi / lihat akun User dengan id `targetUserId`: diri sendiri, Superadmin,
 * staff yang naungan sama dengan owner (`canAccessUser`), atau anak langsung Admin (`parentId`).
 */
export async function canAccessManagedUser(
  actor: User | null,
  targetUserId: number
): Promise<boolean> {
  if (!actor) return false;
  if (actor.role === "Superadmin") return true;
  if (actor.id === targetUserId) return true;
  if (canAccessUser(actor, targetUserId)) return true;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { parentId: true },
  });
  if (target?.parentId != null && target.parentId === actor.id) return true;
  return false;
}

/**
 * Otorisasi khusus MUTASI AKUN USER (ubah profil/password/role/menu staff sendiri),
 * BUKAN untuk akses resource (router/bank/pembayaran/pelanggan/dll.).
 *
 * Kenapa helper ini terpisah dari `canAccessUser`:
 * - `canAccessUser` sengaja mengizinkan Teknisi/Keuangan mengakses baris data yang
 *   "dimiliki" oleh `parentId` mereka (Admin) — itu benar untuk resource operasional
 *   (Admin adalah pemilik router/bank/dst., staff cuma mengelola atas nama Admin).
 * - Tapi kalau aturan yang sama dipakai untuk memutasi baris tabel User milik parentId,
 *   artinya staff bisa mengubah password/role akun Admin induknya sendiri → staff bisa
 *   mengambil alih akun Admin (privilege escalation / account takeover).
 * - Karena itu otorisasi akun (siapa boleh mengubah baris User siapa) dan otorisasi
 *   resource (siapa boleh mengakses data siapa) HARUS dua konsep berbeda. Helper ini
 *   hanya boleh dipakai untuk mutasi akun User, jangan pernah dipakai untuk resource.
 *
 * Aturan:
 * - Superadmin: boleh ke user manapun.
 * - Diri sendiri: boleh (field yang boleh diubah tetap dibatasi di route handler).
 * - Admin induk: boleh ke staff dan Admin tambahan yang `parentId`-nya adalah id mitra.
 * - Admin tambahan: boleh ke staff dan Admin tambahan di mitra yang sama, tidak boleh mengubah akun induk.
 * - Selain itu (termasuk Teknisi/Keuangan ke akun Admin induknya, atau lintas tenant): TOLAK.
 */
export async function canManageUserAccount(
  actor: User | null,
  targetUserId: number
): Promise<boolean> {
  if (!actor) return false;
  if (actor.role === "Superadmin") return true;
  if (actor.id === targetUserId) return true;
  if (actor.role !== "Admin") return false;

  const mitraId = getOwnedResourcesUserId(actor);
  if (targetUserId === mitraId && actor.id !== mitraId) return false;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { parentId: true },
  });
  return target?.parentId === mitraId;
}

/**
 * Akses dokumen sensitif user (KTP/NPWP/invoice upload).
 * Bukan `canAccessManagedUser`: staff tidak boleh membaca identitas Admin induknya.
 *
 * - Superadmin: semua user.
 * - Diri sendiri: file sendiri.
 * - Admin: file sendiri + akun di bawah mitra yang sama. Admin tambahan tidak membaca identitas akun induk.
 * - Staff: hanya file sendiri.
 */
export async function canAccessSensitiveUserUpload(
  actor: User | null,
  ownerUserId: number
): Promise<boolean> {
  if (!actor) return false;
  if (actor.role === "Superadmin") return true;
  if (actor.id === ownerUserId) return true;
  if (actor.role === "Admin") {
    const mitraId = getOwnedResourcesUserId(actor);
    if (ownerUserId === mitraId) return actor.id === mitraId;
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { parentId: true },
    });
    return owner?.parentId === mitraId;
  }
  return false;
}

export {
  canBulkMarkPembayaranPelanggan,
  canCancelPembayaranPelanggan,
  canStaffManageBerhenti,
  canStaffManageIsolir,
  canStaffPayViaBank,
} from "@/lib/staff-permissions";

/** Admin boleh menghapus Teknisi/Keuangan dan Admin tambahan di mitra yang sama. */
export function canAdminDeleteOwnStaff(
  actor: (Pick<User, "id" | "role"> & { parentId?: number | null }) | null,
  target: { role: RoleName; parentId: number | null }
): boolean {
  if (!actor || actor.role !== "Admin") return false;
  const mitraId = actor.parentId ?? actor.id;
  if (target.parentId !== mitraId) return false;
  if (target.role === "Teknisi" || target.role === "Keuangan") return true;
  return target.role === "Admin" && target.parentId != null;
}

/** Teks konfirmasi hapus user: Admin menghapus staff sendiri vs kasus umum (mitra/Client dll.). */
export function userDeleteConfirmMessage(
  actor: Pick<User, "id" | "role"> | null,
  target: { role: RoleName; parentId: number | null; nama: string; user: string }
): string {
  const head = `Hapus user "${target.nama}" (@${target.user})?`;
  if (actor && canAdminDeleteOwnStaff(actor, target)) {
    const akun =
      target.role === "Admin" ? "Admin tambahan" : "Teknisi/Keuangan";
    return `${head}\n\nAkun ${akun} ini akan dihapus beserta sesi loginnya. Data operasional mitra (router, pelanggan, PPPoE, paket, bank, pembayaran, dll.) tidak ikut terhapus.`;
  }
  return `${head}\n\nSemua data yang terhubung ke akun ini dapat ikut terhapus atau dilepas—tergantung role user tersebut—misalnya sesi login, router, pelanggan, PPPoE, paket, bank, pembayaran pelanggan, pembayaran mitra, layanan Client, dll.`;
}
