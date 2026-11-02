"use server";

import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import {
  logRouterOsSession,
  routerToCredentialsWithHostPolicy,
  withRouterOsClientForPppProfiles,
} from "@/lib/routeros-session";
import { PPPActive, PPPProfile, PPPSecret } from "@/lib/router-types";
import { logger } from "@/lib/logger";
import { restoreExpiredPppBoosters } from "@/lib/ppp-booster-apply";
import { validateRequest } from "@/lib/auth";
import {
  assertScopedStaffMayUseRouterLevelPpp,
  getRouterForUser,
} from "@/lib/authz";
import { denyWithoutPppoeMenu } from "@/lib/pppoe-menu-access";
import { countPppPackageChanges, jakartaMonthStart } from "@/lib/ppp-package-change-quota";
import {
  fetchPppSnapshotFromRouter,
  logPppRouterError,
  pppRouterConnectErrorMessage,
} from "@/lib/ppp-sync/core";
import { executePppSync, type ExecutePppSyncResult } from "@/lib/ppp-sync/execute";
import { flightSafeText } from "@/lib/utils";

async function requirePppoeActor(): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof validateRequest>>["user"]> }
  | { ok: false; error: string }
> {
  const { user } = await validateRequest();
  if (!user) return { ok: false, error: "Unauthorized" };
  const denied = denyWithoutPppoeMenu(user);
  if (denied) return { ok: false, error: denied };
  return { ok: true, user };
}

async function fetchPppProfilesFromRouter(
  router: { host: string; port: number | null; user: string; password: string },
  routerId: number
) {
  const creds = await routerToCredentialsWithHostPolicy(router);
  return withRouterOsClientForPppProfiles(
    creds,
    routerId,
    async (api) => {
      const profiles = (await api.write("/ppp/profile/print")) as unknown as PPPProfile[];
      return profiles.map((p) => p.name);
    }
  );
}

export async function getPPPProfiles(id: number) {
  try {
    logRouterOsSession("getPPPProfiles_enter", `getPPPProfiles:${id}`, { routerId: id });

    if (!id) return { error: "Bad request" };

    const auth = await requirePppoeActor();
    if (!auth.ok) return { error: auth.error };
    const { user } = auth;

    const router = await getRouterForUser(id, user);
    if (!router) return { error: "Router tidak ditemukan atau akses ditolak" };

    const profiles = await fetchPppProfilesFromRouter(router, id);
    return { data: profiles };
  } catch (err) {
    const error = err as Error & { code?: string };
    logPppRouterError("getPPPProfiles error", error);
    return {
      error: pppRouterConnectErrorMessage(error),
    };
  }
}

export async function syncPPP(id: number): Promise<ExecutePppSyncResult> {
  try {
    if (!id) return { error: "Bad request" };

    const auth = await requirePppoeActor();
    if (!auth.ok) return { error: auth.error };
    const { user } = auth;

    const scoped = await assertScopedStaffMayUseRouterLevelPpp(user);
    if (!scoped.ok) return { error: scoped.error };

    const routerCheck = await getRouterForUser(id, user);
    if (!routerCheck) return { error: "Router tidak ditemukan atau akses ditolak" };

    return executePppSync({
      routerId: id,
      mode: "full",
      source: "manual",
      actor: { userId: user.id, username: user.user },
    });
  } catch (err) {
    const error = err as Error & { code?: string };
    logPppRouterError("syncPPP error", error);
    return { error: pppRouterConnectErrorMessage(error) };
  }
}

export async function realtimeSyncPPP(id: number): Promise<ExecutePppSyncResult> {
  try {
    if (!id) return { error: "Bad request" };

    const auth = await requirePppoeActor();
    if (!auth.ok) return { error: auth.error };
    const { user } = auth;

    const scoped = await assertScopedStaffMayUseRouterLevelPpp(user);
    if (!scoped.ok) return { error: scoped.error };

    const routerCheck = await getRouterForUser(id, user);
    if (!routerCheck) return { error: "Router tidak ditemukan atau akses ditolak" };

    return executePppSync({
      routerId: id,
      mode: "realtime",
      source: "auto",
      actor: { userId: user.id, username: user.user },
    });
  } catch (err) {
    const error = err as Error & { code?: string };
    logPppRouterError("realtimeSyncPPP error", error);
    return { error: pppRouterConnectErrorMessage(error) };
  }
}

export async function revalidatePPP() {
  const auth = await requirePppoeActor();
  if (!auth.ok) return { error: auth.error };
  revalidateTag("ppp");
  return { ok: true as const };
}

export type GetPPP = {
  data: {
    id: number;
    name: string;
    profile: string;
    comment: string | null;
    disabled: string;
    isIsolir: boolean;
    profileBeforeIsolir: string | null;
    on_router: boolean;
    created: Date;
    packageChange: {
      direction: "upgrade" | "downgrade";
      created: string;
    } | null;
    booster: {
      profile: string;
      endsAt: string;
      days: number;
    } | null;
    active_records: {
      address: string;
    } | null;
    pelanggan: {
      id: number;
      nama: string;
      nik: string | null;
      tgl: string;
      stop: boolean;
      tgl_stop: string | null;
      tgl_isolir: number | null;
      autoFilledAt: Date | null;
      alamat: string;
      lat: string | null;
      lng: string | null;
      nomor: string;
      email: string;
      paketId: number;
      pinSendiri: boolean;
      pembayaran: { id: number }[];
      paket: {
        nama: string;
        kapasitas: number;
        harga: number;
      };
      penagihId: number | null;
      penagihNama: string | null;
      penagihAktif: boolean | null;
    } | null;
  }[];
  totalTagih: { harga: number; ppn: number; total: number };
  packageChangeQuota: {
    limit: number | null;
    upgradeUsed: number;
    downgradeUsed: number;
  } | null;
  syncTime: {
    id: number;
    routerId: number;
    updated: Date;
    lastSyncStartedAt: Date | null;
    lastSyncCompletedAt: Date | null;
    lastSyncStatus: "success" | "partial" | "failed" | "skipped" | null;
    lastSyncError: string | null;
    lastSyncSecrets: number | null;
    lastSyncActives: number | null;
    syncInProgress: boolean;
  } | null;
};
export async function getPPP(routerId: number): Promise<GetPPP | { error: string }> {
  try {
    const auth = await requirePppoeActor();
    if (!auth.ok) return { error: auth.error };
    const { user } = auth;

    const routerCheck = await getRouterForUser(routerId, user);
    if (!routerCheck) return { error: "Router tidak ditemukan atau akses ditolak" };

    // Fetch router with users relation for ppn rate
    const router = await prisma.router.findUnique({
      where: { id: routerId },
      include: { users: true },
    });
    if (!router) return { error: "Router tidak ditemukan" };

    try {
      await restoreExpiredPppBoosters(routerId);
    } catch (err) {
      logger.warn({
        msg: "restore ppp booster before getPPP failed",
        routerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const ppnRate = (router.users?.ppn ?? 11) / 100;

    const dateNow = new Date();
    const currentMonthPrefix = dateNow.toLocaleDateString("fr-CA").slice(0, 7);

    const ppp = await prisma.pppSecret.findMany({
      where: {
        routerId: routerId,
      },
      select: {
        id: true,
        name: true,
        profile: true,
        comment: true,
        disabled: true,
        isIsolir: true,
        profileBeforeIsolir: true,
        on_router: true,
        created: true,
        pelanggan: {
          select: {
            id: true,
            nama: true,
            nik: true,
            tgl: true,
            alamat: true,
            lat: true,
            lng: true,
            stop: true,
            tgl_stop: true,
            tgl_isolir: true,
            autoFilledAt: true,
            email: true,
            nomor: true,
            paketId: true,
            portalPinHash: true,
            pembayaran: {
              where: {
                jatuh_tempo: {
                  startsWith: currentMonthPrefix,
                },
              },
              select: {
                id: true,
              },
            },
            paket: {
              select: {
                nama: true,
                kapasitas: true,
                harga: true,
              },
            },
            penagihPenugasan: {
              select: {
                penagihId: true,
                penagih: { select: { nama: true, aktif: true } },
              },
            },
          },
        },
        active_records: {
          select: {
            address: true,
          },
        },
      },
    });
    const syncTime = await prisma.pppSync.findFirst({
      where: { routerId: routerId },
    });

    const date = new Date();
    const firstDate = new Date(date.getFullYear(), date.getMonth(), 1).toLocaleDateString("fr-CA");
    const lastDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toLocaleDateString("fr-CA");

    const tagihan = await prisma.pembayaran.aggregate({
      where: {
        pelanggan: {
          routerId: routerId,
        },
        jatuh_tempo: {
          gte: firstDate,
          lte: lastDate,
        },
      },
      _sum: {
        total: true,
      },
    });

    const total = tagihan._sum.total || 0;
    const harga = total / (1 + ppnRate);
    const ppn = total - harga;

    const totalTagih = {
      harga,
      ppn,
      total,
    };

    const monthStart = jakartaMonthStart();
    const packageChanges = await prisma.pppPackageChange.findMany({
      where: { routerId, created: { gte: monthStart } },
      orderBy: { created: "desc" },
      select: { pppSecretId: true, direction: true, created: true },
    });
    const packageChangeBySecret = new Map<
      number,
      { direction: "upgrade" | "downgrade"; created: string }
    >();
    for (const change of packageChanges) {
      if (packageChangeBySecret.has(change.pppSecretId)) continue;
      if (change.direction !== "upgrade" && change.direction !== "downgrade") continue;
      packageChangeBySecret.set(change.pppSecretId, {
        direction: change.direction,
        created: change.created.toISOString(),
      });
    }

    let packageChangeQuota: {
      limit: number | null;
      upgradeUsed: number;
      downgradeUsed: number;
    } | null = null;
    if (user.role !== "Superadmin" && router.userId != null) {
      const [owner, counts] = await Promise.all([
        prisma.user.findUnique({
          where: { id: router.userId },
          select: { pppPackageChangeLimit: true },
        }),
        countPppPackageChanges(router.userId),
      ]);
      packageChangeQuota = {
        limit: owner?.pppPackageChangeLimit ?? null,
        ...counts,
      };
    }

    const activeBoosters = await prisma.pppBooster.findMany({
      where: { routerId, restoredAt: null },
      select: { pppSecretId: true, boosterProfile: true, endsAt: true, days: true },
    });
    const boosterBySecret = new Map<
      number,
      { profile: string; endsAt: string; days: number }
    >();
    for (const booster of activeBoosters) {
      boosterBySecret.set(booster.pppSecretId, {
        profile: booster.boosterProfile,
        endsAt: booster.endsAt.toISOString(),
        days: booster.days,
      });
    }

    const data = ppp.map((row) => ({
      ...row,
      packageChange: packageChangeBySecret.get(row.id) ?? null,
      booster: boosterBySecret.get(row.id) ?? null,
      name: flightSafeText(row.name) ?? row.name,
      profile: flightSafeText(row.profile) ?? row.profile,
      comment: flightSafeText(row.comment),
      pelanggan: row.pelanggan
        ? {
            id: row.pelanggan.id,
            nama: flightSafeText(row.pelanggan.nama) ?? row.pelanggan.nama,
            nik: flightSafeText(row.pelanggan.nik),
            tgl: row.pelanggan.tgl,
            stop: row.pelanggan.stop,
            tgl_stop: row.pelanggan.tgl_stop,
            tgl_isolir: row.pelanggan.tgl_isolir,
            autoFilledAt: row.pelanggan.autoFilledAt,
            alamat: flightSafeText(row.pelanggan.alamat) ?? row.pelanggan.alamat,
            lat: row.pelanggan.lat,
            lng: row.pelanggan.lng,
            nomor: flightSafeText(row.pelanggan.nomor) ?? row.pelanggan.nomor,
            email: flightSafeText(row.pelanggan.email) ?? row.pelanggan.email,
            paketId: row.pelanggan.paketId,
            pembayaran: row.pelanggan.pembayaran,
            paket: row.pelanggan.paket,
            pinSendiri: Boolean(row.pelanggan.portalPinHash),
            penagihId: row.pelanggan.penagihPenugasan?.penagihId ?? null,
            penagihNama: row.pelanggan.penagihPenugasan?.penagih.nama ?? null,
            penagihAktif: row.pelanggan.penagihPenugasan?.penagih.aktif ?? null,
          }
        : null,
      active_records: row.active_records
        ? {
            address:
              flightSafeText(row.active_records.address) ??
              row.active_records.address,
          }
        : null,
    }));

    const json = {
      data,
      totalTagih,
      packageChangeQuota,
      syncTime,
    };
    return json;
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "getPPP error", error: error.message });
    return { error: error.message };
  }
}

export async function nonRegisteredPPP(id: number) {
  try {
    if (!id) throw new Error("Bad request");

    const auth = await requirePppoeActor();
    if (!auth.ok) throw new Error(auth.error);
    const { user } = auth;

    const routerCheck = await getRouterForUser(id, user);
    if (!routerCheck) throw new Error("Router tidak ditemukan atau akses ditolak");

    // Fetch router with users relation for ppn rate
    const router = await prisma.router.findUnique({
      where: { id: id },
      include: { users: true },
    });
    if (!router) throw new Error("Router tidak ditemukan");

    const ppnRate = (router.users?.ppn ?? 11) / 100;

    const { pppActive, pppSecret } = await fetchPppSnapshotFromRouter(
      router,
      `nonRegisteredPPP:${id}`
    );

    const existingSecrets = await prisma.pppSecret.findMany({
      where: {
        routerId: router.id,
      },
    });
    const existingActives = await prisma.pppActive.findMany({
      where: {
        routerId: router.id,
      },
    });

    const existingSecretNames = new Set(existingSecrets.map((s) => s.name));
    const existingActiveNames = new Set(existingActives.map((a) => a.name));

    const secretsToCreate = pppSecret.filter(
      (val) => !existingSecretNames.has(val.name)
    );
    const secretsToUpdate = pppSecret.filter((val) =>
      existingSecretNames.has(val.name)
    );

    const activesToCreate = pppActive.filter(
      (val) => !existingActiveNames.has(val.name)
    );
    const activesToUpdate = pppActive.filter((val) =>
      existingActiveNames.has(val.name)
    );

    const ppp = await prisma.pppSecret.findMany({
      where: {
        routerId: router.id,
        name: { notIn: pppSecret.map((val) => val.name) },
      },
      select: {
        id: true,
        name: true,
        profile: true,
        comment: true,
        disabled: true,
        pelanggan: {
          select: {
            id: true,
            nama: true,
            tgl: true,
            alamat: true,
            stop: true,
            tgl_stop: true,
            email: true,
            nomor: true,
            paketId: true,
            paket: {
              select: {
                nama: true,
                kapasitas: true,
                harga: true,
              },
            },
          },
        },
        active_records: {
          select: {
            address: true,
          },
        },
      },
    });

    const syncTime = await prisma.pppSync.upsert({
      where: { routerId: router.id },
      create: { routerId: router.id },
      update: { routerId: router.id, updated: new Date() },
    });

    const pppSubs = ppp.filter((val) => !val.pelanggan?.stop);
    const totalTagih = {
      harga: pppSubs.reduce(
        (acc, val) => acc + (val.pelanggan?.paket.harga || 0),
        0
      ),
      ppn: pppSubs.reduce(
        (acc, val) => acc + (val.pelanggan?.paket.harga || 0) * ppnRate,
        0
      ),
      total: pppSubs.reduce(
        (acc, val) =>
          acc +
          ((val.pelanggan?.paket.harga || 0) +
            (val.pelanggan?.paket.harga || 0) * ppnRate),
        0
      ),
    };

    const json = {
      data: ppp,
      totalTagih,
      syncTime,
    };

    return json;
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "nonRegisteredPPP error", error: error.message });
    return { error: error.message };
  }
}
