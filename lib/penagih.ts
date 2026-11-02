import { hapusKomisiTagihanTidakLunas } from "@/lib/komisi-petugas";
import { formatIsolirActor } from "@/lib/isolir-actor-label";
import prisma from "@/lib/prisma";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import {
  retireAkunForDeletedPenagih,
  syncPenagihAkun,
} from "@/lib/penagih-akun";
import {
  inactiveAssignmentError,
  shouldRecordAssignmentChange,
  canAccessPenagihan,
} from "@/lib/penagih-rules";
import type { RoleName } from "@prisma/client";

type Actor = {
  id: number;
  role: RoleName;
  parentId?: number | null;
  nama?: string | null;
  user?: string | null;
};

export type PenagihanScope =
  | { ok: true; ownerUserId: number }
  | { ok: false; status: number; error: string };

export async function resolvePenagihanOwner(
  actor: Actor,
  requestedMitraId: number | null
): Promise<PenagihanScope> {
  if (!canAccessPenagihan(actor.role)) {
    return { ok: false, status: 403, error: "Akses ditolak" };
  }
  if (actor.role !== "Superadmin") {
    const ownerUserId = getOwnedResourcesUserId(actor);
    if (requestedMitraId != null && requestedMitraId !== ownerUserId) {
      return { ok: false, status: 403, error: "Akses ditolak" };
    }
    return { ok: true, ownerUserId };
  }
  if (requestedMitraId == null) {
    return { ok: false, status: 400, error: "Pilih mitra" };
  }
  const mitra = await prisma.user.findFirst({
    where: { id: requestedMitraId, role: "Admin", parentId: null },
    select: { id: true },
  });
  if (!mitra) return { ok: false, status: 404, error: "Mitra tidak ditemukan" };
  return { ok: true, ownerUserId: mitra.id };
}

function cleanNama(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 191);
}

function cleanNomor(value: string | null | undefined): string | null {
  const nomor = value?.trim() ?? "";
  return nomor ? nomor.slice(0, 32) : null;
}

export type PetugasBoardRow = {
  id: number;
  nama: string;
  nomor: string | null;
  aktif: boolean;
  jumlahPelanggan: number;
  akunUser: string | null;
  komisiNominal: number;
  komisiSaldo: number;
  komisiDibatalkan: number;
};

export async function listPetugasBoard(ownerUserId: number): Promise<PetugasBoardRow[]> {
  await hapusKomisiTagihanTidakLunas(prisma);
  const [rows, entries] = await Promise.all([
    listPenagih(ownerUserId),
    prisma.komisiPetugasEntri.findMany({
      where: { ownerUserId },
      select: { penagihId: true, nominal: true },
    }),
  ]);
  const byPenagih = new Map<number, { saldo: number; dibatalkan: number }>();
  for (const entry of entries) {
    const current = byPenagih.get(entry.penagihId) ?? { saldo: 0, dibatalkan: 0 };
    current.saldo += entry.nominal;
    if (entry.nominal < 0) current.dibatalkan += -entry.nominal;
    byPenagih.set(entry.penagihId, current);
  }
  return rows.map((row) => {
    const komisi = byPenagih.get(row.id);
    return {
      id: row.id,
      nama: row.nama,
      nomor: row.nomor,
      aktif: row.aktif,
      jumlahPelanggan: row._count.penugasan,
      akunUser: row.akun?.user ?? null,
      komisiNominal: row.komisiNominal,
      komisiSaldo: komisi?.saldo ?? 0,
      komisiDibatalkan: komisi?.dibatalkan ?? 0,
    };
  });
}

export async function listPenagih(ownerUserId: number) {
  return prisma.penagih.findMany({
    where: { ownerUserId },
    orderBy: [{ aktif: "desc" }, { nama: "asc" }],
    select: {
      id: true,
      nama: true,
      nomor: true,
      aktif: true,
      komisiNominal: true,
      akun: { select: { user: true } },
      _count: { select: { penugasan: true } },
    },
  });
}

export async function createPenagih(params: {
  ownerUserId: number;
  nama: string;
  nomor?: string | null;
  username?: string | null;
  password?: string | null;
  komisiNominal?: number;
}) {
  const nama = cleanNama(params.nama);
  if (nama.length < 2) {
    return { ok: false as const, status: 400, error: "Nama petugas minimal 2 karakter" };
  }
  const row = await prisma.penagih.create({
    data: {
      ownerUserId: params.ownerUserId,
      nama,
      nomor: cleanNomor(params.nomor),
      komisiNominal: params.komisiNominal ?? 0,
    },
    select: { id: true, nama: true, nomor: true, aktif: true, komisiNominal: true },
  });
  if (params.username?.trim() || params.password?.trim()) {
    const akun = await syncPenagihAkun({
      penagihId: row.id,
      ownerUserId: params.ownerUserId,
      username: params.username,
      password: params.password,
    });
    if (!akun.ok) {
      await prisma.penagih.delete({ where: { id: row.id } });
      return akun;
    }
  }
  return { ok: true as const, penagih: row };
}

export async function updatePenagih(params: {
  ownerUserId: number;
  penagihId: number;
  nama?: string;
  nomor?: string | null;
  aktif?: boolean;
  username?: string | null;
  password?: string | null;
  cabutAkun?: boolean;
  komisiNominal?: number;
}) {
  const existing = await prisma.penagih.findFirst({
    where: { id: params.penagihId, ownerUserId: params.ownerUserId },
    select: { id: true },
  });
  if (!existing) return { ok: false as const, status: 404, error: "Petugas tidak ditemukan" };
  const nama = params.nama == null ? undefined : cleanNama(params.nama);
  if (nama != null && nama.length < 2) {
    return { ok: false as const, status: 400, error: "Nama petugas minimal 2 karakter" };
  }
  const row = await prisma.penagih.update({
    where: { id: existing.id },
    data: {
      ...(nama != null ? { nama } : {}),
      ...(params.nomor !== undefined ? { nomor: cleanNomor(params.nomor) } : {}),
      ...(params.aktif !== undefined ? { aktif: params.aktif } : {}),
      ...(params.komisiNominal !== undefined ? { komisiNominal: params.komisiNominal } : {}),
    },
    select: { id: true, nama: true, nomor: true, aktif: true, komisiNominal: true },
  });
  const akun = await syncPenagihAkun({
    penagihId: row.id,
    ownerUserId: params.ownerUserId,
    username: params.username,
    password: params.password,
    cabut: params.cabutAkun,
  });
  if (!akun.ok) return akun;
  return { ok: true as const, penagih: row };
}

async function pelangganInMitra(ownerUserId: number, pelangganIds: number[]) {
  const rows = await prisma.pelanggan.findMany({
    where: {
      id: { in: pelangganIds },
      router: { userId: ownerUserId, deleted: false },
    },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

export async function assignPelangganToPenagih(params: {
  ownerUserId: number;
  actor: Actor;
  penagihId: number;
  pelangganIds: number[];
}) {
  const ids = [...new Set(params.pelangganIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    return { ok: false as const, status: 400, error: "Pilih pelanggan" };
  }
  if (ids.length > 500) {
    return { ok: false as const, status: 400, error: "Maksimal 500 pelanggan sekaligus" };
  }
  const penagih = await prisma.penagih.findFirst({
    where: { id: params.penagihId, ownerUserId: params.ownerUserId },
    select: { id: true, nama: true, aktif: true },
  });
  if (!penagih) return { ok: false as const, status: 404, error: "Petugas tidak ditemukan" };
  const inactive = inactiveAssignmentError(penagih.aktif);
  if (inactive) return { ok: false as const, status: 400, error: inactive };

  const allowed = await pelangganInMitra(params.ownerUserId, ids);
  if (allowed.size !== ids.length) {
    return { ok: false as const, status: 403, error: "Ada pelanggan di luar mitra ini" };
  }

  const current = await prisma.penagihPenugasan.findMany({
    where: { pelangganId: { in: ids } },
    select: { pelangganId: true, penagihId: true, penagih: { select: { nama: true } } },
  });
  const currentMap = new Map(current.map((row) => [row.pelangganId, row]));
  const changes = ids.filter((id) =>
    shouldRecordAssignmentChange(currentMap.get(id)?.penagihId ?? null, penagih.id)
  );

  await prisma.$transaction(async (tx) => {
    for (const pelangganId of changes) {
      const previous = currentMap.get(pelangganId);
      await tx.penagihPenugasan.upsert({
        where: { pelangganId },
        create: {
          pelangganId,
          penagihId: penagih.id,
          ownerUserId: params.ownerUserId,
        },
        update: {
          penagihId: penagih.id,
          ownerUserId: params.ownerUserId,
        },
      });
      await tx.penagihPenugasanLog.create({
        data: {
          pelangganId,
          ownerUserId: params.ownerUserId,
          dariPenagihId: previous?.penagihId ?? null,
          dariNama: previous?.penagih.nama ?? null,
          kePenagihId: penagih.id,
          keNama: penagih.nama,
          actorUserId: params.actor.id,
        },
      });
    }
  });

  return { ok: true as const, updated: changes.length, skipped: ids.length - changes.length };
}

export async function clearPelangganPenagih(params: {
  ownerUserId: number;
  actor: Actor;
  pelangganIds: number[];
}) {
  const ids = [...new Set(params.pelangganIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    return { ok: false as const, status: 400, error: "Pilih pelanggan" };
  }
  const allowed = await pelangganInMitra(params.ownerUserId, ids);
  if (allowed.size !== ids.length) {
    return { ok: false as const, status: 403, error: "Ada pelanggan di luar mitra ini" };
  }
  const current = await prisma.penagihPenugasan.findMany({
    where: { pelangganId: { in: ids }, ownerUserId: params.ownerUserId },
    select: { pelangganId: true, penagihId: true, penagih: { select: { nama: true } } },
  });
  if (current.length === 0) {
    return { ok: true as const, updated: 0 };
  }
  await prisma.$transaction(async (tx) => {
    for (const row of current) {
      await tx.penagihPenugasan.delete({ where: { pelangganId: row.pelangganId } });
      await tx.penagihPenugasanLog.create({
        data: {
          pelangganId: row.pelangganId,
          ownerUserId: params.ownerUserId,
          dariPenagihId: row.penagihId,
          dariNama: row.penagih.nama,
          kePenagihId: null,
          keNama: null,
          actorUserId: params.actor.id,
        },
      });
    }
  });
  return { ok: true as const, updated: current.length };
}

export async function deletePenagih(params: {
  ownerUserId: number;
  actor: Actor;
  penagihId: number;
}) {
  const penagih = await prisma.penagih.findFirst({
    where: { id: params.penagihId, ownerUserId: params.ownerUserId },
    select: { id: true, nama: true, userId: true },
  });
  if (!penagih) return { ok: false as const, status: 404, error: "Petugas tidak ditemukan" };
  const assigned = await prisma.penagihPenugasan.findMany({
    where: { penagihId: penagih.id, ownerUserId: params.ownerUserId },
    select: { pelangganId: true },
  });
  await prisma.$transaction(async (tx) => {
    if (assigned.length > 0) {
      await tx.penagihPenugasanLog.createMany({
        data: assigned.map((row) => ({
          pelangganId: row.pelangganId,
          ownerUserId: params.ownerUserId,
          dariPenagihId: penagih.id,
          dariNama: penagih.nama,
          kePenagihId: null,
          keNama: null,
          actorUserId: params.actor.id,
        })),
      });
    }
    if (penagih.userId) {
      await tx.penagih.update({
        where: { id: penagih.id },
        data: { userId: null },
      });
    }
    await tx.penagih.delete({ where: { id: penagih.id } });
  });
  await retireAkunForDeletedPenagih(penagih.userId);
  return { ok: true as const, removedAssignments: assigned.length };
}

export async function movePenagihPelanggan(params: {
  ownerUserId: number;
  actor: Actor;
  dariPenagihId: number;
  kePenagihId: number;
}) {
  if (params.dariPenagihId === params.kePenagihId) {
    return { ok: false as const, status: 400, error: "Pilih petugas pengganti yang berbeda" };
  }
  const [dari, ke] = await Promise.all([
    prisma.penagih.findFirst({
      where: { id: params.dariPenagihId, ownerUserId: params.ownerUserId },
      select: { id: true },
    }),
    prisma.penagih.findFirst({
      where: { id: params.kePenagihId, ownerUserId: params.ownerUserId },
      select: { id: true, aktif: true },
    }),
  ]);
  if (!dari || !ke) return { ok: false as const, status: 404, error: "Petugas tidak ditemukan" };
  const inactive = inactiveAssignmentError(ke.aktif);
  if (inactive) return { ok: false as const, status: 400, error: inactive };

  const rows = await prisma.penagihPenugasan.findMany({
    where: { ownerUserId: params.ownerUserId, penagihId: dari.id },
    select: { pelangganId: true },
  });
  if (rows.length === 0) return { ok: true as const, updated: 0, skipped: 0 };
  return assignPelangganToPenagih({
    ownerUserId: params.ownerUserId,
    actor: params.actor,
    penagihId: ke.id,
    pelangganIds: rows.map((row) => row.pelangganId),
  });
}

export async function listPenugasanPelanggan(params: {
  ownerUserId: number;
  q?: string;
  penagihId?: number | null;
  page: number;
  limit: number;
}) {
  const q = params.q?.trim() ?? "";
  const where = {
    router: { userId: params.ownerUserId, deleted: false },
    ...(q
      ? {
          OR: [
            { nama: { contains: q } },
            { noLayanan: { contains: q } },
            { alamat: { contains: q } },
            { ppp_secret: { name: { contains: q } } },
          ],
        }
      : {}),
    ...(params.penagihId === 0
      ? { penagihPenugasan: null }
      : params.penagihId
        ? { penagihPenugasan: { penagihId: params.penagihId } }
        : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.pelanggan.count({ where }),
    prisma.pelanggan.findMany({
      where,
      orderBy: { nama: "asc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true,
        nama: true,
        noLayanan: true,
        alamat: true,
        ppp_secret: { select: { name: true } },
        penagihPenugasan: {
          select: { penagih: { select: { id: true, nama: true, aktif: true } } },
        },
      },
    }),
  ]);
  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      nama: row.nama,
      noLayanan: row.noLayanan,
      alamat: row.alamat,
      pppUsername: row.ppp_secret?.name ?? "",
      penagihId: row.penagihPenugasan?.penagih.id ?? null,
      penagihNama: row.penagihPenugasan?.penagih.nama ?? null,
      penagihAktif: row.penagihPenugasan?.penagih.aktif ?? null,
    })),
  };
}

export async function listPenugasanRiwayat(ownerUserId: number) {
  const rows = await prisma.penagihPenugasanLog.findMany({
    where: { ownerUserId },
    orderBy: { created: "desc" },
    take: 40,
    select: {
      id: true,
      created: true,
      actorUserId: true,
      pelanggan: { select: { nama: true, noLayanan: true } },
      dariPenagih: { select: { nama: true } },
      kePenagih: { select: { nama: true } },
      dariNama: true,
      keNama: true,
    },
  });
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.actorUserId))] } },
    select: { id: true, nama: true, user: true },
  });
  const actorMap = new Map(actors.map((actor) => [actor.id, formatIsolirActor(actor)]));
  return rows.map((row) => ({
    id: row.id,
    created: row.created.toISOString(),
    pelanggan: row.pelanggan.nama,
    noLayanan: row.pelanggan.noLayanan,
    dari: row.dariNama ?? row.dariPenagih?.nama ?? "—",
    ke: row.keNama ?? row.kePenagih?.nama ?? "—",
    actor: actorMap.get(row.actorUserId) ?? "—",
  }));
}
