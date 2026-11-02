import type { User } from "lucia";

import { getPelangganInScope } from "@/lib/authz";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { normalizePortalWaCs, portalWaCsUrl } from "@/lib/portal-slug";
import { getStaffPelangganScopeIds, isStaffPelangganScopedRole } from "@/lib/staff-pelanggan-scope";
import prisma from "@/lib/prisma";

export const PORTAL_TIKET_KATEGORI = ["keluhan", "lainnya"] as const;
export const PORTAL_TIKET_STATUS = ["baru", "diproses", "selesai"] as const;
export const PORTAL_TIKET_PRIORITAS = ["rendah", "normal", "tinggi"] as const;

export type PortalTiketKategori = (typeof PORTAL_TIKET_KATEGORI)[number];
export type PortalTiketStatus = (typeof PORTAL_TIKET_STATUS)[number];
export type PortalTiketPrioritas = (typeof PORTAL_TIKET_PRIORITAS)[number];

export const PORTAL_TIKET_KATEGORI_LABEL: Record<PortalTiketKategori, string> = {
  keluhan: "Keluhan",
  lainnya: "Lainnya",
};

export const PORTAL_TIKET_STATUS_LABEL: Record<PortalTiketStatus, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
};

export const PORTAL_TIKET_PRIORITAS_LABEL: Record<PortalTiketPrioritas, string> = {
  rendah: "Rendah",
  normal: "Normal",
  tinggi: "Tinggi",
};

const MAX_OPEN = 3;
const JUDUL_MIN = 3;
const JUDUL_MAX = 120;
const PESAN_MIN = 10;
const PESAN_MAX = 2000;

export type PortalTiketItem = {
  id: number;
  kategori: PortalTiketKategori;
  judul: string;
  pesan: string;
  wa: string | null;
  waUrl: string | null;
  noLayanan: string | null;
  prioritas: PortalTiketPrioritas;
  status: PortalTiketStatus;
  balasan: string | null;
  created: string;
};

export type StaffPortalTiketItem = PortalTiketItem & {
  pelangganNama: string;
  diprosesOleh: string | null;
};

export function normalizePortalTiketWa(raw: string): string | null {
  const nomor = normalizePortalWaCs(raw);
  if (!nomor || nomor.length < 10 || nomor.length > 15 || !nomor.startsWith("0")) {
    return null;
  }
  return nomor;
}

/** Nomor terdaftar yang lolos aturan WhatsApp. Selain itu kolom dikosongkan. */
export function portalTiketWaDefault(registered: string): string {
  return normalizePortalTiketWa(registered) ?? "";
}

export function normalizePortalTiketNoLayanan(raw: string): string | null {
  const digits = String(raw).replace(/\D/g, "");
  return digits.length === 12 ? digits : null;
}

export function portalTiketNoLayananDefault(registered: string): string {
  return normalizePortalTiketNoLayanan(registered) ?? "";
}

export function portalTiketInputError(input: {
  kategori: string;
  judul: string;
  pesan: string;
  wa: string;
  prioritas: string;
}): string | null {
  if (!PORTAL_TIKET_KATEGORI.includes(input.kategori as PortalTiketKategori)) {
    return "Pilih jenis tiket.";
  }
  if (!PORTAL_TIKET_PRIORITAS.includes(input.prioritas as PortalTiketPrioritas)) {
    return "Pilih prioritas tiket.";
  }
  const judul = input.judul.trim();
  if (judul.length < JUDUL_MIN || judul.length > JUDUL_MAX) {
    return "Judul tiket 3–120 karakter.";
  }
  const pesan = input.pesan.trim();
  if (pesan.length < PESAN_MIN || pesan.length > PESAN_MAX) {
    return "Isi tiket 10–2000 karakter.";
  }
  if (!normalizePortalTiketWa(input.wa)) {
    return "Nomor WhatsApp 10–15 digit, diawali 0.";
  }
  return null;
}

export function portalTiketBalasanError(input: {
  status: string;
  balasan: string;
}): string | null {
  if (!PORTAL_TIKET_STATUS.includes(input.status as PortalTiketStatus)) {
    return "Status tiket tidak valid.";
  }
  if (input.balasan.trim().length > PESAN_MAX) {
    return "Balasan maksimal 2000 karakter.";
  }
  return null;
}

function toItem(row: {
  id: number;
  kategori: PortalTiketKategori;
  judul: string;
  pesan: string;
  wa: string | null;
  noLayanan: string | null;
  prioritas: PortalTiketPrioritas;
  status: PortalTiketStatus;
  balasan: string | null;
  created: Date;
}): PortalTiketItem {
  return {
    id: row.id,
    kategori: row.kategori,
    judul: row.judul,
    pesan: row.pesan,
    wa: row.wa,
    waUrl: portalWaCsUrl(row.wa),
    noLayanan: row.noLayanan,
    prioritas: row.prioritas,
    status: row.status,
    balasan: row.balasan,
    created: row.created.toISOString(),
  };
}

export async function listPortalTiketForPelanggan(
  pelangganId: number
): Promise<PortalTiketItem[]> {
  const rows = await prisma.portalTiket.findMany({
    where: { pelangganId },
    orderBy: { created: "desc" },
    take: 30,
    select: {
      id: true,
      kategori: true,
      judul: true,
      pesan: true,
      wa: true,
      noLayanan: true,
      prioritas: true,
      status: true,
      balasan: true,
      created: true,
    },
  });
  return rows.map(toItem);
}

export async function createPortalTiket(
  pelangganId: number,
  input: {
    kategori: PortalTiketKategori;
    judul: string;
    pesan: string;
    wa: string;
    prioritas: PortalTiketPrioritas;
  }
): Promise<{ ok: true } | { error: string }> {
  const row = await prisma.pelanggan.findFirst({
    where: {
      id: pelangganId,
      ppp_secretId: { not: null },
      router: {
        deleted: false,
        userId: { not: null },
        users: {
          role: "Admin",
          disabled: false,
          OR: [
            { portalPelangganEnabled: true },
            {
              portalBersamaAnggota: { some: { portal: { enabled: true } } },
            },
          ],
        },
      },
    },
    select: { noLayanan: true, router: { select: { userId: true } } },
  });
  const userId = row?.router.userId;
  const wa = normalizePortalTiketWa(input.wa);
  const noLayanan = row?.noLayanan ?? null;
  if (!userId) return { error: "Portal ini tidak tersedia." };
  if (!wa) return { error: "Nomor WhatsApp 10–15 digit, diawali 0." };
  if (!noLayanan) return { error: "No. layanan akun tidak ditemukan." };

  const open = await prisma.portalTiket.count({
    where: {
      pelangganId,
      status: { in: ["baru", "diproses"] },
    },
  });
  if (open >= MAX_OPEN) {
    return {
      error:
        "Masih ada 3 tiket yang belum selesai. Tunggu balasan sebelum membuat tiket baru.",
    };
  }

  await prisma.portalTiket.create({
    data: {
      pelangganId,
      userId,
      kategori: input.kategori,
      judul: input.judul.trim(),
      pesan: input.pesan.trim(),
      wa,
      noLayanan,
      prioritas: input.prioritas,
    },
  });
  return { ok: true };
}

async function staffTiketWhere(
  user: Pick<User, "id" | "role" | "parentId">
): Promise<{ userId?: number; pelangganId?: { in: number[] } } | null> {
  if (user.role === "Superadmin") return {};
  if (user.role === "Admin") {
    return { userId: getOwnedResourcesUserId(user) };
  }
  if (isStaffPelangganScopedRole(user.role)) {
    if (user.parentId == null) return null;
    const where: { userId: number; pelangganId?: { in: number[] } } = {
      userId: user.parentId,
    };
    const scopeIds = await getStaffPelangganScopeIds(user.id);
    if (scopeIds !== null) {
      if (scopeIds.length === 0) return null;
      where.pelangganId = { in: scopeIds };
    }
    return where;
  }
  return null;
}

export async function countPortalTiketBaruForStaff(
  user: Pick<User, "id" | "role" | "parentId">
): Promise<number> {
  const where = await staffTiketWhere(user);
  if (!where) return 0;
  return prisma.portalTiket.count({
    where: { ...where, status: "baru" },
  });
}

export async function listPortalTiketForStaff(
  user: Pick<User, "id" | "role" | "parentId">
): Promise<StaffPortalTiketItem[]> {
  const where = await staffTiketWhere(user);
  if (!where) return [];

  const rows = await prisma.portalTiket.findMany({
    where,
    orderBy: [{ status: "asc" }, { prioritas: "desc" }, { created: "desc" }],
    take: 100,
    select: {
      id: true,
      kategori: true,
      judul: true,
      pesan: true,
      wa: true,
      noLayanan: true,
      prioritas: true,
      status: true,
      balasan: true,
      created: true,
      diprosesOleh: { select: { nama: true } },
      pelanggan: { select: { nama: true, noLayanan: true, nomor: true } },
    },
  });

  return rows.map((row) => {
    const kontak = normalizePortalTiketWa(row.wa ?? "") ?? normalizePortalTiketWa(row.pelanggan.nomor);
    return {
      ...toItem(row),
      wa: kontak,
      waUrl: portalWaCsUrl(kontak),
      noLayanan: row.noLayanan ?? row.pelanggan.noLayanan,
      pelangganNama: row.pelanggan.nama,
      diprosesOleh: row.diprosesOleh?.nama?.trim() || null,
    };
  });
}

export async function replyPortalTiket(
  user: User,
  tiketId: number,
  input: { status: PortalTiketStatus; balasan: string }
): Promise<{ ok: true } | { error: string }> {
  const tiket = await prisma.portalTiket.findUnique({
    where: { id: tiketId },
    select: { id: true, pelangganId: true },
  });
  if (!tiket) return { error: "Tiket tidak ditemukan." };

  const pelanggan = await getPelangganInScope(tiket.pelangganId, user);
  if (!pelanggan) return { error: "Tidak diizinkan mengubah tiket ini." };

  const balasan = input.balasan.trim();
  const mencatatPemroses = input.status === "diproses" || input.status === "selesai";
  await prisma.portalTiket.update({
    where: { id: tiket.id },
    data: {
      status: input.status,
      balasan: balasan.length > 0 ? balasan : null,
      diprosesOlehId: mencatatPemroses ? user.id : null,
    },
  });
  return { ok: true };
}

export async function deletePortalTiketSelesai(
  user: User,
  tiketId: number
): Promise<{ ok: true } | { error: string }> {
  const tiket = await prisma.portalTiket.findUnique({
    where: { id: tiketId },
    select: { id: true, pelangganId: true, status: true },
  });
  if (!tiket) return { error: "Tiket tidak ditemukan." };
  if (tiket.status !== "selesai") {
    return { error: "Hanya tiket selesai yang bisa dihapus." };
  }

  const pelanggan = await getPelangganInScope(tiket.pelangganId, user);
  if (!pelanggan) return { error: "Tidak diizinkan menghapus tiket ini." };

  await prisma.portalTiket.delete({ where: { id: tiket.id } });
  return { ok: true };
}
