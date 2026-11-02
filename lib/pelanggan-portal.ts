import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { verify } from "argon2";
import { isPppIsolir } from "@/lib/ppp-isolir";
import prisma from "@/lib/prisma";
import {
  billingPeriodFromJatuhTempo,
  formatBillingPeriodLabel,
} from "@/lib/billing-due-date";
import {
  normalizePortalPin,
  normalizePortalSlug,
  portalLoginPath,
  portalPinError,
  portalSlugError,
  portalWaCsUrl,
} from "@/lib/portal-slug";

export const PELANGGAN_PORTAL_COOKIE = "pppoe_pelanggan";
const SESSION_MS = 12 * 60 * 60 * 1000;
const CHOICE_MS = 5 * 60 * 1000;

type LiveSession = { pelangganId: number; exp: number; slug: string };
type ChoiceGrant = { ids: number[]; exp: number };

const portalState = globalThis as typeof globalThis & {
  __portalLiveSessions?: Map<string, LiveSession>;
  __portalChoiceGrants?: Map<string, ChoiceGrant>;
};
if (!portalState.__portalLiveSessions) {
  portalState.__portalLiveSessions = new Map();
}
if (!portalState.__portalChoiceGrants) {
  portalState.__portalChoiceGrants = new Map();
}
const liveSessions = portalState.__portalLiveSessions;
const choiceGrants = portalState.__portalChoiceGrants;

export function resetPelangganPortalStateForTests() {
  liveSessions.clear();
  choiceGrants.clear();
}

function portalSecret(): string {
  return (
    process.env.REGISTER_CHALLENGE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "dev-register-challenge")
  );
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function signBody(body: string): string | null {
  const secret = portalSecret();
  if (!secret) return null;
  const mac = createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

function readSignedBody(token: string): string | null {
  const secret = portalSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const macB = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest();
  let provided: Buffer;
  try {
    provided = fromB64url(macB);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  return body;
}

/** Nomor lokal 0… agar 0812… dan 62812… dianggap sama. */
export function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) digits = `0${digits.slice(2)}`;
  return digits;
}

export function isPlausiblePhone(raw: string): boolean {
  const digits = normalizePhoneDigits(raw);
  return digits.length >= 10 && digits.length <= 15 && digits.startsWith("0");
}

type SessionPayload = {
  sid: string;
  pelangganId: number;
  exp: number;
  slug?: string;
};
type ChoicePayload = { nonce: string; ids: number[]; exp: number };

function readJson<T>(token: string | null | undefined): T | null {
  if (!token) return null;
  const body = readSignedBody(token);
  if (!body) return null;
  try {
    return JSON.parse(fromB64url(body).toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** Sesi baru setiap login. Cookie lama tidak lagi berlaku setelah dicabut. */
export function issuePelangganPortalSession(
  pelangganId: number,
  exp = Date.now() + SESSION_MS,
  slug = ""
): string | null {
  if (!Number.isInteger(pelangganId) || pelangganId <= 0) return null;
  const sid = randomBytes(16).toString("hex");
  const cleanSlug = normalizePortalSlug(slug) ?? "";
  const payload: SessionPayload = {
    sid,
    pelangganId,
    exp,
    ...(cleanSlug ? { slug: cleanSlug } : {}),
  };
  const token = signBody(b64url(Buffer.from(JSON.stringify(payload), "utf8")));
  if (!token) return null;
  liveSessions.set(sid, { pelangganId, exp, slug: cleanSlug });
  return token;
}

export function revokePelangganPortalSession(token: string | null | undefined) {
  const payload = readJson<SessionPayload>(token);
  if (payload?.sid) liveSessions.delete(payload.sid);
}

/** Tutup semua sesi portal pelanggan ini, misalnya setelah mitra mengganti PIN. */
export function revokePelangganPortalSessions(pelangganId: number) {
  for (const [sid, live] of liveSessions) {
    if (live.pelangganId === pelangganId) liveSessions.delete(sid);
  }
}

export function readPelangganPortalSession(
  token: string | null | undefined
): number | null {
  const payload = readJson<SessionPayload>(token);
  if (!payload) return null;
  if (!payload.sid || payload.exp < Date.now()) {
    if (payload.sid) liveSessions.delete(payload.sid);
    return null;
  }
  if (!Number.isInteger(payload.pelangganId) || payload.pelangganId <= 0) {
    return null;
  }
  const live = liveSessions.get(payload.sid);
  if (!live || live.exp < Date.now() || live.pelangganId !== payload.pelangganId) {
    return null;
  }
  return live.pelangganId;
}

export function readPelangganPortalSlug(
  token: string | null | undefined
): string | null {
  if (!readPelangganPortalSession(token)) return null;
  const payload = readJson<SessionPayload>(token);
  return normalizePortalSlug(payload?.slug);
}

/** PIN/WA portal bersama yang sedang dipakai sesi ini. null = pakai milik mitra. */
export async function sharedPortalKontak(
  slug: string | null | undefined
): Promise<{ pinHash: string | null; wa: string | null } | null> {
  const clean = normalizePortalSlug(slug);
  if (!clean) return null;
  const group = await prisma.portalBersama.findFirst({
    where: { slug: clean, enabled: true, kontakMode: "bersama" },
    select: { pinHash: true, waCs: true },
  });
  if (!group) return null;
  return { pinHash: group.pinHash, wa: group.waCs };
}

export function readPelangganPortalLoginPath(
  token: string | null | undefined
): string {
  if (!readPelangganPortalSession(token)) return "/pppoe/masuk";
  const payload = readJson<SessionPayload>(token);
  return portalLoginPath(payload?.slug);
}

/** Sesi hanya mengizinkan id yang tersimpan di server, bukan id dari klien. */
export function portalSessionAllows(
  token: string | null | undefined,
  pelangganId: number
): boolean {
  const owner = readPelangganPortalSession(token);
  return owner != null && owner === pelangganId;
}

export function issuePelangganChoiceToken(ids: number[]): string | null {
  const clean = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (clean.length === 0) return null;
  const nonce = randomBytes(16).toString("hex");
  const exp = Date.now() + CHOICE_MS;
  const payload: ChoicePayload = { nonce, ids: clean, exp };
  const token = signBody(b64url(Buffer.from(JSON.stringify(payload), "utf8")));
  if (!token) return null;
  choiceGrants.set(nonce, { ids: clean, exp });
  return token;
}

/** Sekali pakai. Id di luar daftar yang diverifikasi ditolak. */
export function consumePelangganChoice(
  token: string | null | undefined,
  pelangganId: number
): boolean {
  const payload = readJson<ChoicePayload>(token);
  if (!payload?.nonce) return false;
  const grant = choiceGrants.get(payload.nonce);
  choiceGrants.delete(payload.nonce);
  if (!grant || grant.exp < Date.now()) return false;
  if (!Number.isInteger(pelangganId) || !grant.ids.includes(pelangganId)) {
    return false;
  }
  return true;
}

export type PelangganPortalMatch = {
  id: number;
  nama: string;
  noLayanan: string;
  mitra: string;
  mitraUserId: number;
};

export type PortalOwner = {
  id: number;
  nama: string;
  slug: string;
  ownerIds: number[];
  bersama: boolean;
  /** true = PIN dan WhatsApp portal bersama, bukan tiap mitra. */
  kontakBersama: boolean;
  sharedPinHash: string | null;
};

export type LockedBersamaPortal = {
  nama: string;
  slug: string;
  kontakMode: "beda" | "bersama";
};

/** Link bersama yang hidup dan memuat mitra ini. Kosong = mitra masih mengatur portal sendiri. */
export async function lockedBersamaForMitra(
  userId: number
): Promise<LockedBersamaPortal[]> {
  if (!Number.isInteger(userId) || userId <= 0) return [];
  const rows = await prisma.portalBersamaMitra.findMany({
    where: { userId, portal: { enabled: true } },
    select: {
      portal: { select: { nama: true, slug: true, kontakMode: true } },
    },
    orderBy: { portal: { nama: "asc" } },
  });
  return rows.map((row) => ({
    nama: row.portal.nama,
    slug: row.portal.slug,
    kontakMode: row.portal.kontakMode === "bersama" ? "bersama" : "beda",
  }));
}

export async function findEnabledPortalOwner(
  rawSlug: string
): Promise<PortalOwner | null> {
  const slug = normalizePortalSlug(rawSlug);
  if (!slug || portalSlugError(slug, false)) return null;

  const group = await prisma.portalBersama.findFirst({
    where: { slug, enabled: true },
    select: {
      id: true,
      nama: true,
      slug: true,
      kontakMode: true,
      pinHash: true,
      anggota: {
        where: { user: { role: "Admin", disabled: false } },
        select: { userId: true },
      },
    },
  });
  if (group) {
    if (group.anggota.length === 0) return null;
    const kontakBersama = group.kontakMode === "bersama";
    return {
      id: group.id,
      nama: group.nama,
      slug: group.slug,
      ownerIds: group.anggota.map((row) => row.userId),
      bersama: true,
      kontakBersama,
      sharedPinHash: kontakBersama ? group.pinHash : null,
    };
  }

  const owner = await prisma.user.findFirst({
    where: {
      portalSlug: slug,
      portalPelangganEnabled: true,
      role: "Admin",
      disabled: false,
    },
    select: { id: true, nama: true, portalSlug: true },
  });
  if (!owner?.portalSlug) return null;
  return {
    id: owner.id,
    nama: owner.nama,
    slug: owner.portalSlug,
    ownerIds: [owner.id],
    bersama: false,
    kontakBersama: false,
    sharedPinHash: null,
  };
}

/**
 * PIN sendiri pelanggan mengalahkan PIN mitra.
 * Pelanggan tanpa PIN sendiri memakai PIN mitra.
 */
export async function selectPortalMatchesForPin(
  matches: PelangganPortalMatch[],
  rawPin: unknown,
  sharedPinHash?: string | null
): Promise<
  | { ok: true; matches: PelangganPortalMatch[] }
  | { ok: false; reason: "missing" | "wrong" }
> {
  const pin = normalizePortalPin(rawPin);
  if (!pin || portalPinError(pin)) return { ok: false, reason: "wrong" };
  const rows = await prisma.pelanggan.findMany({
    where: { id: { in: matches.map((item) => item.id) } },
    select: {
      id: true,
      portalPinHash: true,
      router: { select: { users: { select: { portalPinHash: true } } } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const mitraPinOk = new Map<string, boolean>();
  const picked: PelangganPortalMatch[] = [];
  for (const match of matches) {
    const row = byId.get(match.id);
    if (!row) continue;
    if (row.portalPinHash) {
      try {
        if (await verify(row.portalPinHash, pin)) picked.push(match);
      } catch {
        /* hash rusak dianggap tidak cocok */
      }
      continue;
    }
    const mitraHash = sharedPinHash || row.router.users?.portalPinHash;
    if (!mitraHash) continue;
    let ok = mitraPinOk.get(mitraHash);
    if (ok === undefined) {
      try {
        ok = await verify(mitraHash, pin);
      } catch {
        ok = false;
      }
      mitraPinOk.set(mitraHash, ok);
    }
    if (ok) picked.push(match);
  }
  if (picked.length > 0) return { ok: true, matches: picked };
  const anyMitraPin = rows.some(
    (row) =>
      !row.portalPinHash && (sharedPinHash || row.router.users?.portalPinHash)
  );
  const anyDefault = rows.some((row) => !row.portalPinHash);
  if (anyDefault && !anyMitraPin) return { ok: false, reason: "missing" };
  return { ok: false, reason: "wrong" };
}

export async function currentPortalPinMatches(
  pelangganId: number,
  rawPin: unknown,
  sharedPinHash?: string | null
): Promise<boolean> {
  const pin = normalizePortalPin(rawPin);
  if (!pin || portalPinError(pin)) return false;
  const row = await prisma.pelanggan.findFirst({
    where: { id: pelangganId },
    select: {
      portalPinHash: true,
      router: { select: { users: { select: { portalPinHash: true } } } },
    },
  });
  const hash =
    row?.portalPinHash || sharedPinHash || row?.router.users?.portalPinHash;
  if (!hash) return false;
  try {
    return await verify(hash, pin);
  } catch {
    return false;
  }
}

/** missing = belum ada PIN. wrong = PIN tidak cocok. */
export async function portalPinStatusForHashes(
  hashes: Array<string | null | undefined>,
  rawPin: unknown
): Promise<"ok" | "missing" | "wrong"> {
  const usable = hashes.filter((hash): hash is string => Boolean(hash));
  if (usable.length === 0) return "missing";
  const pin = normalizePortalPin(rawPin);
  if (!pin || portalPinError(pin)) return "wrong";
  for (const hash of usable) {
    try {
      if (await verify(hash, pin)) return "ok";
    } catch {
      /* lanjut ke hash lain */
    }
  }
  return "wrong";
}

/** missing = mitra belum mengatur PIN. wrong = PIN tidak cocok. */
export async function portalPinStatus(
  ownerUserId: number | number[],
  rawPin: unknown
): Promise<"ok" | "missing" | "wrong"> {
  const ids = (Array.isArray(ownerUserId) ? ownerUserId : [ownerUserId]).filter(
    (id) => Number.isInteger(id) && id > 0
  );
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { portalPinHash: true },
  });
  return portalPinStatusForHashes(
    rows.map((row) => row.portalPinHash),
    rawPin
  );
}

export async function portalLoginPathForPelanggan(
  pelangganId: number
): Promise<string> {
  const row = await prisma.pelanggan.findFirst({
    where: { id: pelangganId },
    select: {
      router: {
        select: {
          users: { select: { portalSlug: true, role: true } },
        },
      },
    },
  });
  if (row?.router.users?.role !== "Admin") return "/pppoe/masuk";
  return portalLoginPath(row.router.users.portalSlug);
}

export async function pelangganOnPortalOwners(
  pelangganId: number,
  ownerUserIds: number[]
): Promise<boolean> {
  if (ownerUserIds.length === 0) return false;
  const row = await prisma.pelanggan.findFirst({
    where: {
      id: pelangganId,
      ppp_secretId: { not: null },
      router: {
        deleted: false,
        userId: { in: ownerUserIds },
        users: { role: "Admin", disabled: false },
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function pelangganOnEnabledPortal(
  pelangganId: number,
  ownerUserId: number
): Promise<boolean> {
  return pelangganOnPortalOwners(pelangganId, [ownerUserId]);
}

export async function findPppoePelangganByPhone(
  rawPhone: string,
  ownerUserId: number | number[]
): Promise<PelangganPortalMatch[]> {
  const local = normalizePhoneDigits(rawPhone);
  const ownerIds = (Array.isArray(ownerUserId) ? ownerUserId : [ownerUserId]).filter(
    (id) => Number.isInteger(id) && id > 0
  );
  if (!isPlausiblePhone(rawPhone) || ownerIds.length === 0) return [];
  const intl = `62${local.slice(1)}`;
  const tail = local.slice(-8);
  const rows = await prisma.pelanggan.findMany({
    where: {
      ppp_secretId: { not: null },
      router: {
        deleted: false,
        userId: { in: ownerIds },
        users: { role: "Admin", disabled: false },
      },
      OR: [
        { nomor: local },
        { nomor: intl },
        { nomor: `+${intl}` },
        { nomor: { contains: tail } },
      ],
    },
    select: {
      id: true,
      nama: true,
      nomor: true,
      noLayanan: true,
      router: {
        select: {
          nama: true,
          userId: true,
          users: { select: { id: true, nama: true } },
        },
      },
    },
    take: 100,
  });
  const seen = new Set<number>();
  const matches: PelangganPortalMatch[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    if (normalizePhoneDigits(row.nomor) !== local) continue;
    seen.add(row.id);
    matches.push({
      id: row.id,
      nama: row.nama,
      noLayanan: row.noLayanan,
      mitra: row.router.users?.nama?.trim() || row.router.nama,
      mitraUserId: row.router.userId ?? row.router.users?.id ?? 0,
    });
  }
  matches.sort(
    (a, b) =>
      a.mitra.localeCompare(b.mitra, "id") || a.nama.localeCompare(b.nama, "id")
  );
  return matches;
}

/** Tagihan portal hanya periode yang sudah berhasil digenerate untuk mitra itu. */
export function isPortalTagihanGenerated(
  jatuhTempo: string,
  generatedPeriods: ReadonlySet<string>
): boolean {
  return generatedPeriods.has(billingPeriodFromJatuhTempo(jatuhTempo));
}

export type PortalTagihan = {
  id: number;
  noInvoice: string;
  periode: string;
  jatuhTempo: string;
  total: number;
  lunas: boolean;
};

export type PortalAccount = {
  nama: string;
  nomor: string;
  alamat: string;
  noLayanan: string;
  mitra: string;
  paketNama: string;
  paketHarga: number;
  kapasitas: number;
  status: "Aktif" | "Isolir" | "Berhenti";
  koneksi: "Online" | "Offline";
  pppName: string;
  pinSendiri: boolean;
  csWa: string | null;
  csWaUrl: string | null;
  tripayEnabled: boolean;
  tagihan: PortalTagihan[];
};

export async function loadPortalAccount(
  pelangganId: number,
  loginSlug?: string | null
): Promise<PortalAccount | null> {
  const row = await prisma.pelanggan.findFirst({
    where: {
      id: pelangganId,
      ppp_secretId: { not: null },
      router: {
        deleted: false,
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
    select: {
      nama: true,
      nomor: true,
      alamat: true,
      noLayanan: true,
      stop: true,
      portalPinHash: true,
      paket: {
        select: {
          nama: true,
          harga: true,
          nominalPembayaran: true,
          kapasitas: true,
        },
      },
      router: {
        select: {
          userId: true,
          nama: true,
          isolirProfileName: true,
          users: { select: { nama: true, portalWaCs: true } },
        },
      },
      ppp_secret: {
        select: {
          name: true,
          profile: true,
          isIsolir: true,
          active_records: { select: { id: true } },
        },
      },
      pembayaran: {
        orderBy: { jatuh_tempo: "desc" },
        select: {
          id: true,
          noInvoice: true,
          jatuh_tempo: true,
          total: true,
          status: true,
        },
      },
    },
  });
  if (!row?.ppp_secret) return null;

  const shared = await sharedPortalKontak(loginSlug);
  const csWa = shared ? shared.wa : row.router.users?.portalWaCs ?? null;

  const isolir = isPppIsolir(row.ppp_secret, {
    isolirProfileName: row.router.isolirProfileName,
  });
  const status = row.stop ? "Berhenti" : isolir ? "Isolir" : "Aktif";
  const generatedLogs =
    row.router.userId == null
      ? []
      : await prisma.billingGenerateLog.findMany({
          where: { userId: row.router.userId, status: "success" },
          select: { period: true },
        });
  const generatedPeriods = new Set(generatedLogs.map((item) => item.period));
  const gateway = row.router.userId
    ? await prisma.tripayGateway.findUnique({
        where: { userId: row.router.userId },
        select: { enabled: true, merchantCode: true, apiKey: true, privateKey: true },
      })
    : null;

  return {
    nama: row.nama,
    nomor: row.nomor,
    alamat: row.alamat,
    noLayanan: row.noLayanan,
    mitra: row.router.users?.nama?.trim() || row.router.nama,
    paketNama: row.paket.nama,
    paketHarga: row.paket.nominalPembayaran ?? row.paket.harga,
    kapasitas: row.paket.kapasitas,
    status,
    koneksi: row.ppp_secret.active_records ? "Online" : "Offline",
    pppName: row.ppp_secret.name,
    pinSendiri: Boolean(row.portalPinHash),
    csWa,
    csWaUrl: portalWaCsUrl(csWa),
    tripayEnabled: Boolean(
      gateway?.enabled && gateway.merchantCode && gateway.apiKey && gateway.privateKey
    ),
    tagihan: row.pembayaran
      .filter((item) => isPortalTagihanGenerated(item.jatuh_tempo, generatedPeriods))
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        noInvoice: item.noInvoice,
        periode: formatBillingPeriodLabel(item.jatuh_tempo),
        jatuhTempo: item.jatuh_tempo,
        total: item.total,
        lunas: item.status === "Terbayar",
      })),
  };
}
