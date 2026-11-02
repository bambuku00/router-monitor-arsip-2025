import type { Prisma, RoleName } from "@prisma/client";

import { hashUserPassword } from "@/lib/password-hash";
import prisma from "@/lib/prisma";

const USERNAME_RE = /^[a-z0-9_-]+$/;

export function normalizePenagihUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  if (!username) return null;
  if (
    username.length < 3 ||
    username.length > 31 ||
    !USERNAME_RE.test(username)
  ) {
    return null;
  }
  return username;
}

export async function penagihScopeForActor(user: {
  id: number;
  role: RoleName;
}): Promise<{
  where: Prisma.PelangganWhereInput | null;
  lock: { id: number; nama: string } | null;
}> {
  if (user.role !== "Petugas") return { where: null, lock: null };
  const row = await prisma.penagih.findFirst({
    where: { userId: user.id, aktif: true },
    select: { id: true, nama: true },
  });
  if (!row) return { where: { id: { in: [] } }, lock: null };
  return {
    where: { penagihPenugasan: { is: { penagihId: row.id } } },
    lock: row,
  };
}

async function usernameTaken(username: string, exceptUserId?: number) {
  const existing = await prisma.user.findFirst({
    where: { user: username, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) },
    select: { id: true },
  });
  return existing != null;
}

async function retirePenagihUser(userId: number) {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: {
      disabled: true,
      user: `retired${userId}`.slice(0, 31),
    },
  });
}

export async function syncPenagihAkun(params: {
  penagihId: number;
  ownerUserId: number;
  username?: string | null;
  password?: string | null;
  cabut?: boolean;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const penagih = await prisma.penagih.findFirst({
    where: { id: params.penagihId, ownerUserId: params.ownerUserId },
    select: { id: true, nama: true, nomor: true, aktif: true, userId: true },
  });
  if (!penagih) {
    return { ok: false, status: 404, error: "Petugas tidak ditemukan" };
  }

  if (params.cabut && penagih.userId) {
    const userId = penagih.userId;
    await prisma.penagih.update({
      where: { id: penagih.id },
      data: { userId: null },
    });
    await retirePenagihUser(userId);
    return { ok: true };
  }

  const username =
    params.username == null ? undefined : normalizePenagihUsername(params.username);
  if (params.username != null && params.username.trim() && !username) {
    return {
      ok: false,
      status: 400,
      error: "Username 3–31 karakter: huruf kecil, angka, _ atau -",
    };
  }

  const password = params.password?.trim() ?? "";
  if (password && (password.length < 6 || password.length > 255)) {
    return { ok: false, status: 400, error: "Password minimal 6 karakter" };
  }

  if (!penagih.userId) {
    if (!username && !password) return { ok: true };
    if (!username) {
      return { ok: false, status: 400, error: "Username wajib diisi untuk akun baru" };
    }
    if (!password) {
      return { ok: false, status: 400, error: "Password wajib diisi untuk akun baru" };
    }
    if (await usernameTaken(username)) {
      return { ok: false, status: 409, error: "Username sudah dipakai" };
    }
    const created = await prisma.user.create({
      data: {
        nama: penagih.nama,
        user: username,
        password: await hashUserPassword(password),
        role: "Petugas",
        parentId: params.ownerUserId,
        nomor: penagih.nomor,
        verified: true,
        disabled: !penagih.aktif,
      },
      select: { id: true },
    });
    await prisma.penagih.update({
      where: { id: penagih.id },
      data: { userId: created.id },
    });
    return { ok: true };
  }

  if (username && (await usernameTaken(username, penagih.userId))) {
    return { ok: false, status: 409, error: "Username sudah dipakai" };
  }

  await prisma.user.update({
    where: { id: penagih.userId },
    data: {
      nama: penagih.nama,
      nomor: penagih.nomor,
      disabled: !penagih.aktif,
      ...(username ? { user: username } : {}),
      ...(password ? { password: await hashUserPassword(password) } : {}),
    },
  });
  if (!penagih.aktif) {
    await prisma.session.deleteMany({ where: { userId: penagih.userId } });
  }
  return { ok: true };
}

export async function retireAkunForDeletedPenagih(userId: number | null) {
  if (!userId) return;
  await retirePenagihUser(userId);
}
