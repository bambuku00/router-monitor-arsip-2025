import type { User } from "lucia";
import type { Prisma } from "@prisma/client";
import { RoleName } from "@prisma/client";

import { canAccessUser, getOwnedResourcesUserId } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export type StaffPelangganOption = {
  id: number;
  nama: string;
  pppUsername: string;
  routerNama: string;
};

export function isStaffPelangganScopedRole(role: RoleName): boolean {
  return role === "Teknisi" || role === "Keuangan";
}

/** null = tidak dibatasi (semua pelanggan mitra); array = hanya ID tersebut. */
export async function getStaffPelangganScopeIds(
  staffUserId: number
): Promise<number[] | null> {
  const rows = await prisma.staffPelangganScope.findMany({
    where: { staffUserId },
    select: { pelangganId: true },
  });
  if (rows.length === 0) return null;
  return rows.map((r) => r.pelangganId);
}

export async function getStaffPelangganScopeWhere(
  user: Pick<User, "id" | "role">
): Promise<Prisma.PelangganWhereInput> {
  if (!isStaffPelangganScopedRole(user.role)) return {};
  const ids = await getStaffPelangganScopeIds(user.id);
  if (ids === null) return {};
  return { id: { in: ids } };
}

export function parseStaffAsQueryParam(
  raw: string | null | undefined
): number | null {
  if (!raw?.trim()) return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Scope pelanggan untuk pembayaran: staff sendiri, atau admin/superadmin
 * melihat sebagai staff (`?staff=userId`).
 */
export async function resolveStaffPelangganScopeWhere(
  actor: Pick<User, "id" | "role" | "parentId">,
  mitraUserId: number,
  staffAsRaw?: string | null
): Promise<Prisma.PelangganWhereInput> {
  const staffAsId = parseStaffAsQueryParam(staffAsRaw);

  if (staffAsId != null) {
    if (isStaffPelangganScopedRole(actor.role)) {
      if (staffAsId !== actor.id) return { id: { in: [] } };
      return getStaffPelangganScopeWhere(actor);
    }

    if (actor.role !== "Superadmin" && !canAccessUser(actor, mitraUserId)) {
      return { id: { in: [] } };
    }

    const staff = await prisma.user.findFirst({
      where: {
        id: staffAsId,
        role: { in: [RoleName.Keuangan, RoleName.Teknisi] },
        parentId: mitraUserId,
      },
      select: { id: true },
    });
    if (!staff) return {};

    const ids = await getStaffPelangganScopeIds(staff.id);
    if (ids === null) return {};
    return { id: { in: ids } };
  }

  return getStaffPelangganScopeWhere(actor);
}

/** URL halaman pembayaran mitra; staff Keuangan/Teknisi → preview scope mereka. */
export function pembayaranHrefForUser(val: {
  id: number;
  parentId: number | null;
  parent?: { id: number } | null;
  role: RoleName;
}): string {
  const mitraId = val.parentId ?? val.parent?.id ?? val.id;
  const isStaff =
    val.role === RoleName.Keuangan || val.role === RoleName.Teknisi;
  if (isStaff && val.parentId != null) {
    return `/pembayaran/${mitraId}?staff=${val.id}`;
  }
  return `/pembayaran/${mitraId}`;
}

export async function listPelangganOptionsForMitra(
  mitraUserId: number
): Promise<StaffPelangganOption[]> {
  const rows = await prisma.pelanggan.findMany({
    where: {
      ppp_secretId: { not: null },
      router: { userId: mitraUserId, deleted: false },
    },
    select: {
      id: true,
      nama: true,
      router: { select: { nama: true } },
      ppp_secret: { select: { name: true } },
    },
    orderBy: [{ router: { nama: "asc" } }, { nama: "asc" }],
  });

  return rows
    .filter((r) => r.ppp_secret?.name?.trim())
    .map((r) => ({
      id: r.id,
      nama: r.nama,
      pppUsername: r.ppp_secret!.name,
      routerNama: r.router.nama,
    }));
}

async function validatePelangganIdsForMitra(
  mitraUserId: number,
  pelangganIds: number[]
): Promise<number[]> {
  if (pelangganIds.length === 0) return [];
  const valid = await prisma.pelanggan.findMany({
    where: {
      id: { in: pelangganIds },
      ppp_secretId: { not: null },
      router: { userId: mitraUserId, deleted: false },
    },
    select: { id: true },
  });
  return valid.map((p) => p.id);
}

/**
 * Ganti scope pelanggan staff. `null` = hapus batasan (akses semua pelanggan mitra).
 */
export async function replaceStaffPelangganScope(
  staffUserId: number,
  pelangganIds: number[] | null,
  mitraUserId: number
): Promise<void> {
  await prisma.staffPelangganScope.deleteMany({ where: { staffUserId } });
  if (pelangganIds === null) return;

  const validIds = await validatePelangganIdsForMitra(mitraUserId, pelangganIds);
  if (validIds.length === 0) return;

  await prisma.staffPelangganScope.createMany({
    data: validIds.map((pelangganId) => ({ staffUserId, pelangganId })),
    skipDuplicates: true,
  });
}

export function resolveMitraIdForStaff(
  staff: Pick<User, "id" | "role" | "parentId">
): number {
  return getOwnedResourcesUserId(staff);
}

/** Normalisasi input form: null = tidak dibatasi; array kosong dengan restrict=true = error di caller. */
export function normalizeStaffPelangganScopeInput(
  restrict: boolean,
  pelangganIds: number[] | null | undefined
): number[] | null {
  if (!restrict) return null;
  if (!Array.isArray(pelangganIds)) return [];
  return [...new Set(pelangganIds.filter((id) => Number.isInteger(id) && id > 0))];
}

export function parseStaffPelangganScopeBody(raw: unknown): number[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  return normalizeStaffPelangganScopeInput(true, raw as number[]);
}

export async function loadStaffPelangganScopeForForm(
  staffUserId: number
): Promise<number[] | null> {
  return getStaffPelangganScopeIds(staffUserId);
}

export type StaffAssignmentOption = {
  id: number;
  nama: string;
  user: string;
  role: RoleName;
  /** Tidak punya baris scope = kelola semua pelanggan mitra */
  unrestricted: boolean;
  /** Pelanggan ini termasuk scope staff (hanya meaningful jika !unrestricted) */
  assigned: boolean;
};

export async function listStaffUnderMitra(
  mitraUserId: number
): Promise<StaffAssignmentOption[]> {
  const staff = await prisma.user.findMany({
    where: {
      parentId: mitraUserId,
      role: { in: ["Keuangan", "Teknisi"] },
    },
    select: { id: true, nama: true, user: true, role: true },
    orderBy: [{ role: "asc" }, { nama: "asc" }],
  });

  const restrictedIds = new Set(
    (
      await prisma.staffPelangganScope.findMany({
        where: { staffUserId: { in: staff.map((s) => s.id) } },
        distinct: ["staffUserId"],
        select: { staffUserId: true },
      })
    ).map((r) => r.staffUserId)
  );

  return staff.map((s) => ({
    id: s.id,
    nama: s.nama,
    user: s.user,
    role: s.role,
    unrestricted: !restrictedIds.has(s.id),
    assigned: false,
  }));
}

export async function listStaffAssignmentForPelanggan(
  pelangganId: number,
  mitraUserId: number
): Promise<StaffAssignmentOption[]> {
  const staff = await prisma.user.findMany({
    where: {
      parentId: mitraUserId,
      role: { in: ["Keuangan", "Teknisi"] },
    },
    select: { id: true, nama: true, user: true, role: true },
    orderBy: [{ role: "asc" }, { nama: "asc" }],
  });
  if (staff.length === 0) return [];

  const scopeRows = await prisma.staffPelangganScope.findMany({
    where: { staffUserId: { in: staff.map((s) => s.id) } },
    select: { staffUserId: true, pelangganId: true },
  });

  const scopeByStaff = new Map<number, number[]>();
  for (const row of scopeRows) {
    const cur = scopeByStaff.get(row.staffUserId) ?? [];
    cur.push(row.pelangganId);
    scopeByStaff.set(row.staffUserId, cur);
  }

  return staff.map((s) => {
    const scope = scopeByStaff.get(s.id);
    const unrestricted = scope === undefined;
    const assigned =
      !unrestricted && scope!.includes(pelangganId);
    return {
      id: s.id,
      nama: s.nama,
      user: s.user,
      role: s.role,
      unrestricted,
      assigned,
    };
  });
}

/** Set staff Keuangan/Teknisi yang mengelola pelanggan PPP ini (dari halaman router/ppp). */
export async function syncPelangganStaffAssignment(
  pelangganId: number,
  staffUserIds: number[],
  mitraUserId: number
): Promise<void> {
  const pelanggan = await prisma.pelanggan.findFirst({
    where: {
      id: pelangganId,
      ppp_secretId: { not: null },
      router: { userId: mitraUserId, deleted: false },
    },
    select: { id: true },
  });
  if (!pelanggan) throw new Error("Pelanggan tidak ditemukan");

  const staff = await prisma.user.findMany({
    where: {
      parentId: mitraUserId,
      role: { in: ["Keuangan", "Teknisi"] },
    },
    select: { id: true },
  });

  const assignSet = new Set(
    staff
      .filter((s) => staffUserIds.includes(s.id))
      .map((s) => s.id)
  );

  for (const s of staff) {
    const scopeCount = await prisma.staffPelangganScope.count({
      where: { staffUserId: s.id },
    });
    const unrestricted = scopeCount === 0;
    const shouldAssign = assignSet.has(s.id);

    if (unrestricted) {
      if (shouldAssign) {
        await prisma.staffPelangganScope.create({
          data: { staffUserId: s.id, pelangganId },
        });
      }
      continue;
    }

    if (shouldAssign) {
      await prisma.staffPelangganScope.upsert({
        where: {
          staffUserId_pelangganId: { staffUserId: s.id, pelangganId },
        },
        create: { staffUserId: s.id, pelangganId },
        update: {},
      });
    } else {
      await prisma.staffPelangganScope.deleteMany({
        where: { staffUserId: s.id, pelangganId },
      });
    }
  }
}
