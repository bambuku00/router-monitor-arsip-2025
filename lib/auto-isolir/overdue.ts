import {
  billingPeriodFromJatuhTempo,
  monthJatuhTempoRange,
} from "@/lib/billing-due-date";
import { TIME } from "@/lib/constants";
import { parseJatuhTempoParts } from "@/lib/pembayaran-tax";
import { isPppIsolir } from "@/lib/ppp-isolir";
import prisma from "@/lib/prisma";
import type { AutoIsolirSettings } from "@prisma/client";

export type OverdueCustomerCandidate = {
  userId: number;
  pelangganId: number;
  pelangganNama: string;
  pembayaranId: number;
  jatuh_tempo: string;
  total: number;
  routerId: number;
  routerNama: string;
  routerIsolirProfile: string | null;
  pppUsername: string;
  pppProfile: string;
  isIsolir: boolean;
  hasActiveSession: boolean;
  settingsProfile: string;
};

export function getJakartaDateString(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

/** Jam:menit WIB (HH:mm) untuk jadwal auto isolir. */
export function getJakartaHourMinute(date = new Date()): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function normalizeExecuteTime(time: string | null | undefined): string {
  const match = (time ?? "00:10").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "00:10";
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** True jika waktu sekarang (WIB) sama dengan jadwal HH:mm di pengaturan mitra. */
export function isExecuteTimeDue(
  executeTime: string | null | undefined,
  now = new Date()
): boolean {
  return getJakartaHourMinute(now) === normalizeExecuteTime(executeTime);
}

/** Hari kalender antara due (YYYY-MM-DD) dan today (YYYY-MM-DD), today >= due. */
export function daysSinceDueDate(dueDateStr: string, todayStr: string): number {
  const due = parseJatuhTempoParts(dueDateStr);
  const today = parseJatuhTempoParts(todayStr);
  const dueMs = Date.UTC(due.year, due.month - 1, due.day);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  return Math.floor((todayMs - dueMs) / TIME.ONE_DAY_MS);
}

/**
 * Tanggal auto isolir = hari `tglIsolir` pada bulan tagihan + toleransi (kalender).
 * Contoh: tagihan Mei, tgl isolir 22, toleransi 2 → 24 Mei (YYYY-MM-DD).
 */
export function computeAutoIsolirDate(
  jatuhTempo: string,
  tglIsolir: number,
  toleranceDays: number
): string {
  const { year, month } = parseJatuhTempoParts(jatuhTempo);
  const day = Math.min(Math.max(1, Math.trunc(tglIsolir)), 31);
  const ms = Date.UTC(year, month - 1, day) + toleranceDays * TIME.ONE_DAY_MS;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Siap auto isolir jika pelanggan punya `tgl_isolir` dan hari ini >= tanggal isolir + toleransi.
 * Tanpa `tgl_isolir` → tidak ikut auto isolir (hanya manual).
 */
export function isReadyForAutoIsolir(
  jatuhTempo: string,
  tglIsolir: number | null | undefined,
  toleranceDays: number,
  todayStr = getJakartaDateString()
): boolean {
  if (tglIsolir == null || tglIsolir < 1) return false;
  const isolirDate = computeAutoIsolirDate(jatuhTempo, tglIsolir, toleranceDays);
  return todayStr >= isolirDate;
}

/** Lewati tagihan Belum jika bulan tagihan yang sama sudah ada record Terbayar. */
export function unpaidPeriodAlreadyPaid(
  jatuhTempo: string,
  paidPeriods: ReadonlySet<string> | undefined
): boolean {
  if (!paidPeriods || paidPeriods.size === 0) return false;
  return paidPeriods.has(billingPeriodFromJatuhTempo(jatuhTempo));
}

/** Auto isolir hanya mengecek tagihan bulan kalender berjalan (WIB), bukan tunggakan lama. */
export function isCurrentBillingPeriod(
  jatuhTempo: string,
  todayStr: string
): boolean {
  return billingPeriodFromJatuhTempo(jatuhTempo) === todayStr.slice(0, 7);
}

/** Satu kandidat per pelanggan: tagihan Belum terlama yang lolos filter. */
export function mergeEarliestUnpaidCandidate<T extends { jatuh_tempo: string }>(
  current: T | undefined,
  next: T
): T {
  if (!current) return next;
  const currentPeriod = billingPeriodFromJatuhTempo(current.jatuh_tempo);
  const nextPeriod = billingPeriodFromJatuhTempo(next.jatuh_tempo);
  return nextPeriod < currentPeriod ? next : current;
}

/** @deprecated Gunakan isReadyForAutoIsolir — logika lama berbasis jatuh tempo saja. */
export function isPastTolerance(
  jatuhTempo: string,
  toleranceDays: number,
  todayStr = getJakartaDateString()
): boolean {
  if (todayStr < jatuhTempo) return false;
  return daysSinceDueDate(jatuhTempo, todayStr) > toleranceDays;
}

export async function getAutoIsolirSettings(userId: number) {
  return prisma.autoIsolirSettings.findUnique({ where: { userId } });
}

export async function getOrCreateAutoIsolirSettings(userId: number) {
  return prisma.autoIsolirSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/**
 * Pelanggan overdue yang memenuhi syarat auto isolir untuk satu mitra.
 */
export async function getOverdueCustomers(
  userId: number,
  options?: {
    settings?: AutoIsolirSettings | null;
    todayStr?: string;
  }
): Promise<OverdueCustomerCandidate[]> {
  const settings =
    options?.settings ?? (await getAutoIsolirSettings(userId));
  const toleranceDays = settings?.toleranceDays ?? 1;
  const onlyActive = settings?.onlyActiveCustomers ?? true;
  const settingsProfile = settings?.isolirProfileName ?? "ISOLIR";
  const todayStr = options?.todayStr ?? getJakartaDateString();
  const currentPeriod = todayStr.slice(0, 7);
  const currentMonthRange = monthJatuhTempoRange(currentPeriod);

  const routers = await prisma.router.findMany({
    where: { userId, deleted: false },
    select: { id: true, nama: true, isolirProfileName: true },
  });
  if (routers.length === 0) return [];

  const routerIds = routers.map((r) => r.id);
  const routerMap = new Map(routers.map((r) => [r.id, r]));

  const unpaid = await prisma.pembayaran.findMany({
    where: {
      status: "Belum",
      nonaktif: false,
      jatuh_tempo: currentMonthRange,
      pelanggan: {
        stop: false,
        routerId: { in: routerIds },
        ppp_secretId: { not: null },
        /** Hanya pelanggan dengan tanggal isolir terisi ikut auto isolir. */
        tgl_isolir: { not: null },
      },
    },
    include: {
      pelanggan: {
        include: {
          ppp_secret: {
            include: { active_records: true },
          },
        },
      },
    },
  });

  const pelangganIds = [...new Set(unpaid.map((pemb) => pemb.pelangganId))];
  const paidRows =
    pelangganIds.length === 0
      ? []
      : await prisma.pembayaran.findMany({
          where: {
            pelangganId: { in: pelangganIds },
            status: "Terbayar",
            nonaktif: false,
          },
          select: { pelangganId: true, jatuh_tempo: true },
        });

  const paidPeriodsByPelanggan = new Map<number, Set<string>>();
  for (const row of paidRows) {
    const periods =
      paidPeriodsByPelanggan.get(row.pelangganId) ?? new Set<string>();
    periods.add(billingPeriodFromJatuhTempo(row.jatuh_tempo));
    paidPeriodsByPelanggan.set(row.pelangganId, periods);
  }

  const candidateByPelanggan = new Map<number, OverdueCustomerCandidate>();

  for (const pemb of unpaid) {
    const pel = pemb.pelanggan;
    const ppp = pel.ppp_secret;
    if (!ppp || !ppp.on_router) continue;

    if (pel.routerId == null) continue;

    if (!isCurrentBillingPeriod(pemb.jatuh_tempo, todayStr)) continue;

    if (
      unpaidPeriodAlreadyPaid(
        pemb.jatuh_tempo,
        paidPeriodsByPelanggan.get(pel.id)
      )
    ) {
      continue;
    }

    if (
      !isReadyForAutoIsolir(
        pemb.jatuh_tempo,
        pel.tgl_isolir,
        toleranceDays,
        todayStr
      )
    ) {
      continue;
    }

    const router = routerMap.get(pel.routerId);
    if (!router) continue;

    const isolirProfile =
      router.isolirProfileName?.trim() || settingsProfile.trim();

    if (
      isPppIsolir(ppp, { isolirProfileName: isolirProfile }) ||
      ppp.isIsolir
    ) {
      continue;
    }

    const hasActiveSession = ppp.active_records != null;
    if (onlyActive && !hasActiveSession) continue;

    const candidate: OverdueCustomerCandidate = {
      userId,
      pelangganId: pel.id,
      pelangganNama: pel.nama,
      pembayaranId: pemb.id,
      jatuh_tempo: pemb.jatuh_tempo,
      total: pemb.total,
      routerId: pel.routerId,
      routerNama: router.nama,
      routerIsolirProfile: router.isolirProfileName,
      pppUsername: ppp.name,
      pppProfile: ppp.profile,
      isIsolir: ppp.isIsolir,
      hasActiveSession,
      settingsProfile,
    };

    candidateByPelanggan.set(
      pel.id,
      mergeEarliestUnpaidCandidate(candidateByPelanggan.get(pel.id), candidate)
    );
  }

  return [...candidateByPelanggan.values()];
}

/** Semua mitra Admin dengan auto isolir aktif. */
export async function getEnabledMitraUserIds(): Promise<number[]> {
  const rows = await prisma.autoIsolirSettings.findMany({
    where: { enabled: true },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
