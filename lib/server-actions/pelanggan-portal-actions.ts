"use server";

import { hash } from "argon2";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTrustedClientIpFromHeaders } from "@/lib/request-ip";
import {
  PELANGGAN_PORTAL_COOKIE,
  consumePelangganChoice,
  currentPortalPinMatches,
  findEnabledPortalOwner,
  findPppoePelangganByPhone,
  loadPortalAccount,
  portalPinStatus,
  portalPinStatusForHashes,
  selectPortalMatchesForPin,
  issuePelangganChoiceToken,
  issuePelangganPortalSession,
  isPlausiblePhone,
  normalizePhoneDigits,
  pelangganOnPortalOwners,
  portalLoginPathForPelanggan,
  readPelangganPortalSession,
  readPelangganPortalSlug,
  sharedPortalKontak,
  revokePelangganPortalSession,
} from "@/lib/pelanggan-portal";
import {
  normalizePortalPin,
  normalizePortalSlug,
  portalPinError,
} from "@/lib/portal-slug";
import prisma from "@/lib/prisma";
import {
  PORTAL_PHONE_INVALID,
  PORTAL_RATE_LIMIT_ERROR,
  PORTAL_UNAVAILABLE_ERROR,
  isSameOriginRequest,
  portalAttemptAllowed,
  portalClearFailures,
  portalRecordFailure,
} from "@/lib/pelanggan-portal-security";

const COOKIE_MAX_AGE = 60 * 60 * 12;
const PORTAL_NOT_FOUND = "Nomor HP tidak terdaftar sebagai pelanggan PPPoE.";
const PORTAL_OFF = "Portal ini tidak tersedia.";
const PORTAL_PIN_WRONG = "Nomor HP atau PIN tidak sesuai.";
const PORTAL_PIN_MISSING = "PIN portal belum diatur.";

function cookieSecure(): boolean {
  const v = process.env.SESSION_COOKIE_SECURE;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV === "production";
}

async function rotatePortalCookie(token: string) {
  const jar = await cookies();
  revokePelangganPortalSession(jar.get(PELANGGAN_PORTAL_COOKIE)?.value);
  jar.set(PELANGGAN_PORTAL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/pppoe",
    maxAge: COOKIE_MAX_AGE,
  });
}

function originOk(hdrs: Headers): boolean {
  return isSameOriginRequest({
    host: hdrs.get("x-forwarded-host") ?? hdrs.get("host"),
    origin: hdrs.get("origin"),
  });
}

function clientIpKey(ip: string): string | null {
  if (!ip || ip === "unknown") return null;
  return `ip:${ip}`;
}

export type MasukPelangganState = {
  error?: string;
  choices?: { id: number; nama: string; noLayanan: string; mitra: string }[];
  token?: string;
};

export async function masukPelangganPppoe(
  _prev: MasukPelangganState,
  formData: FormData
): Promise<MasukPelangganState> {
  const hdrs = await headers();
  if (!originOk(hdrs)) return { error: PORTAL_UNAVAILABLE_ERROR };

  const ip = getTrustedClientIpFromHeaders(hdrs);
  const ipKey = clientIpKey(ip);
  if (ipKey && !portalAttemptAllowed(ipKey)) {
    return { error: PORTAL_RATE_LIMIT_ERROR };
  }

  const nomor = String(formData.get("nomor") ?? "").slice(0, 32);
  if (!isPlausiblePhone(nomor)) {
    if (ipKey) portalRecordFailure(ipKey);
    return { error: PORTAL_PHONE_INVALID };
  }

  const phone = normalizePhoneDigits(nomor);
  const phoneKey = `hp:${phone}`;
  if (!portalAttemptAllowed(phoneKey)) {
    return { error: PORTAL_RATE_LIMIT_ERROR };
  }

  const owner = await findEnabledPortalOwner(
    String(formData.get("slug") ?? "")
  );
  if (!owner) return { error: PORTAL_OFF };

  const rawPin = String(formData.get("pin") ?? "").slice(0, 32);
  const found = await findPppoePelangganByPhone(phone, owner.ownerIds);
  if (found.length === 0) {
    const pinStatus = owner.kontakBersama
      ? await portalPinStatusForHashes([owner.sharedPinHash], rawPin)
      : await portalPinStatus(owner.ownerIds, rawPin);
    if (pinStatus === "missing") return { error: PORTAL_PIN_MISSING };
    if (pinStatus !== "ok") {
      portalRecordFailure(phoneKey);
      if (ipKey) portalRecordFailure(ipKey);
      return { error: PORTAL_PIN_WRONG };
    }
  }
  const selected =
    found.length === 0
      ? { ok: true as const, matches: found }
      : await selectPortalMatchesForPin(found, rawPin, owner.sharedPinHash);
  if (!selected.ok) {
    if (selected.reason === "missing") return { error: PORTAL_PIN_MISSING };
    portalRecordFailure(phoneKey);
    if (ipKey) portalRecordFailure(ipKey);
    return { error: PORTAL_PIN_WRONG };
  }
  const matches = selected.matches;
  if (matches.length === 0) {
    portalRecordFailure(phoneKey);
    if (ipKey) portalRecordFailure(ipKey);
    return { error: PORTAL_NOT_FOUND };
  }

  portalClearFailures(phoneKey);
  if (ipKey) portalClearFailures(ipKey);

  if (matches.length === 1) {
    const token = issuePelangganPortalSession(matches[0].id, undefined, owner.slug);
    if (!token) return { error: PORTAL_UNAVAILABLE_ERROR };
    await rotatePortalCookie(token);
    redirect("/pppoe");
  }

  const token = issuePelangganChoiceToken(matches.map((row) => row.id));
  if (!token) return { error: PORTAL_UNAVAILABLE_ERROR };
  return { choices: matches, token };
}

export async function pilihPelangganPppoe(formData: FormData): Promise<void> {
  const hdrs = await headers();
  const slug = normalizePortalSlug(formData.get("slug"));
  const back = slug ? `/pppoe/${slug}` : "/pppoe/masuk";
  if (!originOk(hdrs)) redirect(back);

  const ip = getTrustedClientIpFromHeaders(hdrs);
  const ipKey = clientIpKey(ip);
  if (ipKey && !portalAttemptAllowed(ipKey)) redirect(back);

  const owner = slug ? await findEnabledPortalOwner(slug) : null;
  if (!owner) redirect("/pppoe/masuk");

  const pelangganId = parseInt(String(formData.get("pelangganId") ?? ""), 10);
  const ok = consumePelangganChoice(
    String(formData.get("token") ?? ""),
    pelangganId
  );
  if (!ok || !(await pelangganOnPortalOwners(pelangganId, owner.ownerIds))) {
    if (ipKey) portalRecordFailure(ipKey);
    redirect(`/pppoe/${owner.slug}`);
  }
  const token = issuePelangganPortalSession(pelangganId, undefined, owner.slug);
  if (!token) redirect(`/pppoe/${owner.slug}`);
  await rotatePortalCookie(token);
  redirect("/pppoe");
}

export async function keluarPelangganPppoe(): Promise<void> {
  const hdrs = await headers();
  const jar = await cookies();
  const token = jar.get(PELANGGAN_PORTAL_COOKIE)?.value;
  const pelangganId = originOk(hdrs) ? readPelangganPortalSession(token) : null;
  const nextPath = pelangganId
    ? await portalLoginPathForPelanggan(pelangganId)
    : "/pppoe/masuk";
  if (originOk(hdrs)) revokePelangganPortalSession(token);
  jar.set(PELANGGAN_PORTAL_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/pppoe",
    maxAge: 0,
  });
  redirect(nextPath);
}

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export type UbahPinState = { error?: string; ok?: string };

export async function ubahPinPelanggan(
  _prev: UbahPinState,
  formData: FormData
): Promise<UbahPinState> {
  const hdrs = await headers();
  if (!originOk(hdrs)) return { error: PORTAL_UNAVAILABLE_ERROR };
  const jar = await cookies();
  const sessionToken = jar.get(PELANGGAN_PORTAL_COOKIE)?.value;
  const pelangganId = readPelangganPortalSession(sessionToken);
  if (!pelangganId) return { error: PORTAL_UNAVAILABLE_ERROR };
  const loginSlug = readPelangganPortalSlug(sessionToken);
  const shared = await sharedPortalKontak(loginSlug);
  const akun = await loadPortalAccount(pelangganId, loginSlug);
  if (!akun) return { error: PORTAL_OFF };

  const currentOk = await currentPortalPinMatches(
    pelangganId,
    String(formData.get("pinSekarang") ?? "").slice(0, 32),
    shared?.pinHash
  );
  if (!currentOk) return { error: "PIN saat ini tidak sesuai." };

  if (String(formData.get("mode") ?? "") === "mitra") {
    await prisma.pelanggan.update({
      where: { id: pelangganId },
      data: { portalPinHash: null },
    });
    revalidatePath("/pppoe");
    return { ok: "PIN sendiri dihapus. Masuk berikutnya memakai PIN mitra." };
  }

  const baru = normalizePortalPin(
    String(formData.get("pinBaru") ?? "").slice(0, 32)
  );
  const ulang = normalizePortalPin(
    String(formData.get("pinUlang") ?? "").slice(0, 32)
  );
  const pinErr = portalPinError(baru);
  if (!baru || pinErr) return { error: pinErr || "Isi PIN baru." };
  if (baru !== ulang) return { error: "Ulangan PIN tidak sama." };

  await prisma.pelanggan.update({
    where: { id: pelangganId },
    data: { portalPinHash: await hash(baru, ARGON2_OPTS) },
  });
  revalidatePath("/pppoe");
  return { ok: "PIN sendiri disimpan. Masuk berikutnya memakai PIN ini." };
}
