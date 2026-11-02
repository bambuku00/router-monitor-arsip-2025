"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { validateRequest } from "@/lib/auth";
import {
  PELANGGAN_PORTAL_COOKIE,
  readPelangganPortalSession,
} from "@/lib/pelanggan-portal";
import { PORTAL_UNAVAILABLE_ERROR, isSameOriginRequest } from "@/lib/pelanggan-portal-security";
import { denyWithoutPppoeMenu } from "@/lib/pppoe-menu-access";
import {
  createPortalTiket,
  deletePortalTiketSelesai,
  portalTiketBalasanError,
  portalTiketInputError,
  replyPortalTiket,
  type PortalTiketKategori,
  type PortalTiketPrioritas,
  type PortalTiketStatus,
} from "@/lib/portal-tiket";

export type BuatTiketState = { error?: string; ok?: string };
export type BalasTiketState = { error?: string; ok?: string; tiketId?: number };
export type HapusTiketState = { error?: string; ok?: string; tiketId?: number };

function originOk(hdrs: Headers): boolean {
  return isSameOriginRequest({
    host: hdrs.get("x-forwarded-host") ?? hdrs.get("host"),
    origin: hdrs.get("origin"),
  });
}

export async function buatPortalTiket(
  _prev: BuatTiketState,
  formData: FormData
): Promise<BuatTiketState> {
  const hdrs = await headers();
  if (!originOk(hdrs)) return { error: PORTAL_UNAVAILABLE_ERROR };

  const jar = await cookies();
  const pelangganId = readPelangganPortalSession(
    jar.get(PELANGGAN_PORTAL_COOKIE)?.value
  );
  if (!pelangganId) return { error: "Sesi portal berakhir. Masuk lagi." };

  const kategori = String(formData.get("kategori") ?? "");
  const judul = String(formData.get("judul") ?? "").slice(0, 160);
  const pesan = String(formData.get("pesan") ?? "").slice(0, 2200);
  const wa = String(formData.get("wa") ?? "").slice(0, 32);
  const prioritas = String(formData.get("prioritas") ?? "");
  const invalid = portalTiketInputError({
    kategori,
    judul,
    pesan,
    wa,
    prioritas,
  });
  if (invalid) return { error: invalid };

  const result = await createPortalTiket(pelangganId, {
    kategori: kategori as PortalTiketKategori,
    judul,
    pesan,
    wa,
    prioritas: prioritas as PortalTiketPrioritas,
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/pppoe");
  revalidatePath("/tiket");
  return { ok: "Tiket terkirim. Mitra akan meninjau pesan Anda." };
}

export async function balasPortalTiket(
  _prev: BalasTiketState,
  formData: FormData
): Promise<BalasTiketState> {
  const { user } = await validateRequest();
  if (!user) return { error: "Unauthorized" };
  const denied = denyWithoutPppoeMenu(user);
  if (denied) return { error: denied };

  const tiketId = Number(formData.get("tiketId"));
  if (!Number.isInteger(tiketId) || tiketId <= 0) {
    return { error: "Tiket tidak ditemukan." };
  }
  const status = String(formData.get("status") ?? "");
  const balasan = String(formData.get("balasan") ?? "").slice(0, 2200);
  const invalid = portalTiketBalasanError({ status, balasan });
  if (invalid) return { error: invalid, tiketId };

  const result = await replyPortalTiket(user, tiketId, {
    status: status as PortalTiketStatus,
    balasan,
  });
  if ("error" in result) return { error: result.error, tiketId };

  revalidatePath("/tiket");
  revalidatePath("/pppoe");
  return { ok: "Tiket diperbarui.", tiketId };
}

export async function hapusPortalTiket(
  _prev: HapusTiketState,
  formData: FormData
): Promise<HapusTiketState> {
  const { user } = await validateRequest();
  if (!user) return { error: "Unauthorized" };
  const denied = denyWithoutPppoeMenu(user);
  if (denied) return { error: denied };

  const tiketId = Number(formData.get("tiketId"));
  if (!Number.isInteger(tiketId) || tiketId <= 0) {
    return { error: "Tiket tidak ditemukan." };
  }

  const result = await deletePortalTiketSelesai(user, tiketId);
  if ("error" in result) return { error: result.error, tiketId };

  revalidatePath("/tiket");
  revalidatePath("/pppoe");
  return { ok: "Tiket selesai dihapus.", tiketId };
}
