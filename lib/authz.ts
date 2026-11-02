/**
 * Authorization helpers for tenant-scoped resources.
 * Use these to enforce ownership / scope before acting on Router, Bank, Paket, Pembayaran.
 */
import type { User } from "lucia";
import prisma from "@/lib/prisma";
import { canAccessUser, getOwnedResourcesUserId } from "@/lib/rbac";
import {
  getStaffPelangganScopeIds,
  isStaffPelangganScopedRole,
} from "@/lib/staff-pelanggan-scope";

/** Pelanggan: owner scope + optional batas PPP staff Teknisi/Keuangan. */
export async function getPelangganInScope(pelangganId: number, user: User) {
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    include: { router: true },
  });
  if (!pelanggan?.router) return null;
  const router = pelanggan.router;
  if (router.userId == null) {
    return user.role === "Superadmin" ? pelanggan : null;
  }
  if (!canAccessUser(user, router.userId)) return null;

  if (isStaffPelangganScopedRole(user.role)) {
    const scopeIds = await getStaffPelangganScopeIds(user.id);
    if (scopeIds !== null && !scopeIds.includes(pelangganId)) return null;
  }
  if (user.role === "Petugas") {
    const assigned = await prisma.penagihPenugasan.findFirst({
      where: {
        pelangganId,
        penagih: { userId: user.id, aktif: true },
      },
      select: { pelangganId: true },
    });
    if (!assigned) return null;
  }
  return pelanggan;
}

/** Router: owner (userId), parent scope, or Superadmin. Returns router or null if not allowed. */
export async function getRouterForUser(routerId: number, user: User) {
  if (user.role === "Superadmin") {
    return prisma.router.findUnique({ where: { id: routerId } });
  }
  const ownerIds = [user.id];
  if (user.parentId != null) ownerIds.push(user.parentId);
  return prisma.router.findFirst({
    where: {
      id: routerId,
      userId: { in: ownerIds },
    },
  });
}

/** Bank: owner (scope mitra) atau Superadmin. */
export async function getBankForUser(bankId: number, user: User) {
  if (user.role === "Superadmin") {
    return prisma.bank.findUnique({ where: { id: bankId } });
  }
  const ownerId = getOwnedResourcesUserId(user);
  return prisma.bank.findFirst({
    where: { id: bankId, userId: ownerId },
  });
}

/** Paket: owner (scope mitra) atau Superadmin. */
export async function getPaketForUser(paketId: number, user: User) {
  if (user.role === "Superadmin") {
    return prisma.paket.findUnique({ where: { id: paketId } });
  }
  const ownerId = getOwnedResourcesUserId(user);
  return prisma.paket.findFirst({
    where: { id: paketId, userId: ownerId },
  });
}

/** Pembayaran: in scope via pelanggan.router + batas PPP staff. */
export async function getPembayaranInScope(pembayaranId: number, user: User) {
  const pembayaran = await prisma.pembayaran.findUnique({
    where: { id: pembayaranId },
    include: { pelanggan: { include: { router: true } } },
  });
  if (!pembayaran?.pelangganId) return null;
  const pelanggan = await getPelangganInScope(pembayaran.pelangganId, user);
  return pelanggan ? pembayaran : null;
}

/**
 * Staff Teknisi/Keuangan dengan baris `StaffPelangganScope` tidak boleh mutasi
 * router-level (MikroTik proxy, disable PPP global, dll.) — hanya pelanggan dalam scope.
 */
export async function staffHasRestrictedPelangganScope(
  user: Pick<User, "id" | "role">
): Promise<boolean> {
  if (!isStaffPelangganScopedRole(user.role)) return false;
  const ids = await getStaffPelangganScopeIds(user.id);
  return ids !== null;
}

/**
 * H9: deny router-level PPP mutations for scoped staff when ownership cannot be
 * verified (add/sync/bulk/proxy). Unrestricted staff and Superadmin/Admin unchanged.
 */
export async function assertScopedStaffMayUseRouterLevelPpp(
  user: Pick<User, "id" | "role">
): Promise<{ ok: true } | { ok: false; status: 403; error: string }> {
  if (!(await staffHasRestrictedPelangganScope(user))) return { ok: true };
  return {
    ok: false,
    status: 403,
    error:
      "Akun staff dengan batas pelanggan PPP tidak dapat melakukan operasi router-level ini.",
  };
}

/**
 * H9: scoped staff may mutate a PPP secret only if it is linked to an assigned pelanggan.
 * Unlinked secrets cannot be verified → deny. Unrestricted staff: router ownership only.
 */
export async function assertStaffMayMutatePppSecret(
  user: User,
  pppSecret: { id: number; routerId: number; name: string }
): Promise<{ ok: true } | { ok: false; status: 403; error: string }> {
  const router = await getRouterForUser(pppSecret.routerId, user);
  if (!router) {
    return { ok: false, status: 403, error: "Unauthorized" };
  }
  if (!(await staffHasRestrictedPelangganScope(user))) return { ok: true };

  const pelanggan = await prisma.pelanggan.findFirst({
    where: { ppp_secretId: pppSecret.id },
    select: { id: true },
  });
  if (!pelanggan) {
    return {
      ok: false,
      status: 403,
      error: "PPP ini tidak terhubung ke pelanggan dalam scope Anda",
    };
  }
  const inScope = await getPelangganInScope(pelanggan.id, user);
  if (!inScope) {
    return { ok: false, status: 403, error: "Akses ditolak" };
  }
  return { ok: true };
}
