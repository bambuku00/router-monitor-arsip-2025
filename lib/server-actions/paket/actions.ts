"use server";

import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { logger } from "@/lib/logger";
import { isImportablePppProfile } from "@/lib/mikrotik-paket";
import {
  classifyPaketsMissingFromMikrotik,
  routerNamesForPaket,
} from "@/lib/paket-mikrotik-presence";
import { normalizePaketProfileName } from "@/lib/ppp-bulk-fill-resolve-paket";
import prisma from "@/lib/prisma";
import { canAccessUser, getOwnedResourcesUserId } from "@/lib/rbac";
import {
  routerToCredentialsWithHostPolicy,
  withRouterOsClientForPppProfiles,
} from "@/lib/routeros-session";
import {
  ROUTEROS_AUTH_FAILED_MSG,
  ROUTEROS_PROTOCOL_UNCERTAIN_MSG,
  ROUTEROS_SSL_REQUIRED_MSG,
  ROUTEROS_UNREACHABLE_MSG,
  userFacingRouterOsErrorMessage,
} from "@/lib/routeros-messages";
import { PPPProfile } from "@/lib/router-types";

const ROUTER_NOT_CONNECTED_MSG =
  "Router tidak terhubung. Periksa koneksi atau nyalakan MikroTik.";

function paketRouterConnectErrorMessage(error: Error & { code?: string }): string {
  if (
    error.code === "ROUTEROS_SSL_REQUIRED" ||
    error.code === "ROUTEROS_PROTOCOL_UNCERTAIN" ||
    error.code === "ROUTEROS_UNREACHABLE" ||
    error.code === "ROUTEROS_AUTH_FAILED"
  ) {
    return error.message;
  }
  if (
    error.message === ROUTEROS_SSL_REQUIRED_MSG ||
    error.message === ROUTEROS_PROTOCOL_UNCERTAIN_MSG ||
    error.message === ROUTEROS_UNREACHABLE_MSG ||
    error.message === ROUTEROS_AUTH_FAILED_MSG
  ) {
    return error.message;
  }
  if (isExpectedPaketRouterError(error)) {
    return ROUTER_NOT_CONNECTED_MSG;
  }
  return userFacingRouterOsErrorMessage(error) || "Gagal mengambil paket dari Mikrotik";
}

function isExpectedPaketRouterError(err: Error & { code?: string }): boolean {
  const msg = err.message || "";
  return (
    msg === ROUTER_NOT_CONNECTED_MSG ||
    err.code === "ROUTEROS_SSL_REQUIRED" ||
    err.code === "ROUTEROS_PROTOCOL_UNCERTAIN" ||
    err.code === "ROUTEROS_UNREACHABLE" ||
    err.code === "ROUTEROS_AUTH_FAILED" ||
    err.code === "ROUTEROS_CONNECT_TIMEOUT" ||
    err.code === "ECONNREFUSED" ||
    err.code === "ETIMEDOUT" ||
    msg === ROUTEROS_SSL_REQUIRED_MSG ||
    msg === ROUTEROS_PROTOCOL_UNCERTAIN_MSG ||
    msg === ROUTEROS_UNREACHABLE_MSG ||
    msg === ROUTEROS_AUTH_FAILED_MSG
  );
}

export type SyncPaketFromMikrotikResult =
  | {
      added: number;
      skipped: number;
      profiles: string[];
    }
  | { error: string };

const paketRouterLinkSelect = {
  where: { router: { deleted: false } },
  select: { router: { select: { nama: true } } },
  orderBy: { router: { nama: "asc" as const } },
};

async function replacePaketRouterLinks(
  routerId: number,
  ownerUserId: number,
  paketIds: number[]
) {
  const unique = [...new Set(paketIds)];
  await prisma.$transaction(async (tx) => {
    await tx.paketRouter.deleteMany({
      where: { routerId, paket: { userId: ownerUserId } },
    });
    if (unique.length === 0) return;
    const owned = await tx.paket.findMany({
      where: { id: { in: unique }, userId: ownerUserId, deleted: false },
      select: { id: true },
    });
    if (owned.length === 0) return;
    await tx.paketRouter.createMany({
      data: owned.map((row) => ({ paketId: row.id, routerId })),
    });
  });
}

export async function syncPaketFromMikrotik(
  routerId: number
): Promise<SyncPaketFromMikrotikResult> {
  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };

  try {
    const router = await getRouterForUser(routerId, user);
    if (!router) return { error: "Router tidak ditemukan atau akses ditolak" };

    const ownerId =
      router.userId ??
      (user.role === "Superadmin" ? user.id : getOwnedResourcesUserId(user));

    const profiles = await withRouterOsClientForPppProfiles(
      await routerToCredentialsWithHostPolicy(router),
      routerId,
      async (api) => {
        const rows = (await api.write(
          "/ppp/profile/print"
        )) as unknown as PPPProfile[];
        return rows;
      }
    );

    const existing = await prisma.paket.findMany({
      where: { userId: ownerId, deleted: false },
      select: { id: true, nama: true },
    });
    const byName = new Map(existing.map((p) => [p.nama, p]));
    const byNormalized = new Map(
      existing.flatMap((row) => {
        const key = normalizePaketProfileName(row.nama);
        return key ? [[key, row] as const] : [];
      })
    );

    let added = 0;
    let skipped = 0;
    const imported: string[] = [];
    const linkedIds: number[] = [];

    for (const profile of profiles) {
      if (!isImportablePppProfile(profile.name)) {
        skipped++;
        continue;
      }

      const normalized = normalizePaketProfileName(profile.name);
      const current =
        byName.get(profile.name) ??
        (normalized ? byNormalized.get(normalized) : undefined);

      if (current) {
        linkedIds.push(current.id);
        skipped++;
        continue;
      }

      // Hanya nama profil. Kapasitas dan harga diisi manual setelah sinkron.
      const created = await prisma.paket.create({
        data: {
          nama: profile.name,
          kapasitas: 0,
          harga: 0,
          userId: ownerId,
        },
        select: { id: true, nama: true },
      });
      byName.set(profile.name, created);
      if (normalized) byNormalized.set(normalized, created);
      linkedIds.push(created.id);
      added++;
      imported.push(profile.name);
    }

    await replacePaketRouterLinks(router.id, ownerId, linkedIds);

    return { added, skipped, profiles: imported };
  } catch (err) {
    const error = err as Error & { code?: string };
    logger.error({
      msg: "syncPaketFromMikrotik error",
      routerId,
      error: error.message,
      code: error.code,
    });
    return { error: paketRouterConnectErrorMessage(error) };
  }
}

export async function getPaket() {
  const { user, session } = await validateRequest();
  if (!session)
    return {
      error: "Unauthorized",
    };
  try {
    let paket;
    if (user?.role === "Superadmin") {
      paket = await prisma.paket.findMany({
        // Hanya `user.nama` dipakai components/paket/data.tsx — password TIDAK di-select.
        include: {
          user: { select: { nama: true } },
          pelanggan: { distinct: ["id"] },
          routerLinks: paketRouterLinkSelect,
        },
        where: { deleted: false },
        orderBy: {
          created: "desc",
        },
      });
    } else {
      paket = await prisma.paket.findMany({
        where: { userId: getOwnedResourcesUserId(user), deleted: false },
        include: {
          pelanggan: { distinct: ["id"], where: { stop: false } },
          routerLinks: paketRouterLinkSelect,
        },
        orderBy: {
          created: "desc",
        },
      });
    }
    return { data: paket };
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "getPaket error", error: error.message });
    return {
      error: "Terjadi kesalahan pada server",
    };
  }
}

export async function getPaketByUser(id: number) {
  const { session, user } = await validateRequest();
  if (!session || !user)
    return {
      error: "Unauthorized",
    };
  if (!canAccessUser(user, id)) {
    return { error: "Unauthorized" };
  }
  try {
    const paket = await prisma.paket.findMany({
      where: { userId: id, deleted: false },
      include: {
        pelanggan: { distinct: ["id"], where: { stop: false } },
        routerLinks: paketRouterLinkSelect,
      },
      orderBy: {
        created: "desc",
      },
    });
    return { data: paket };
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "getPaketByUser error", error: error.message });
    return {
      error: "Terjadi kesalahan pada server",
    };
  }
}

export type PaketMissingFromMikrotikResult = {
  deletable: { id: number; nama: string }[];
  usedMissing: { id: number; nama: string; pelanggan: number }[];
  failedRouters: { nama: string }[];
  placements: { id: number; nama: string; routers: string[]; unchecked: boolean }[];
};

async function readPaketMikrotikPresence(): Promise<
  PaketMissingFromMikrotikResult | { error: string }
> {
  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };

  const ownerScope =
    user.role === "Superadmin" ? null : getOwnedResourcesUserId(user);
  const routers = await prisma.router.findMany({
    where: {
      deleted: false,
      ...(ownerScope != null ? { userId: ownerScope } : { userId: { not: null } }),
    },
    select: {
      id: true,
      nama: true,
      host: true,
      port: true,
      user: true,
      password: true,
      userId: true,
    },
    orderBy: { id: "asc" },
  });

  const profilesByOwner = new Map<number, Set<string>>();
  const ownersWithFailedRouter = new Set<number>();
  const ownersWithRouter = new Set<number>();
  const failedRouters: { nama: string }[] = [];
  const readRouters: { id: number; nama: string; userId: number; names: Set<string> }[] = [];

  for (const router of routers) {
    if (router.userId == null) continue;
    ownersWithRouter.add(router.userId);
    try {
      const rows = await withRouterOsClientForPppProfiles(
        await routerToCredentialsWithHostPolicy(router),
        router.id,
        async (api) =>
          (await api.write("/ppp/profile/print")) as unknown as PPPProfile[]
      );
      const names = new Set<string>();
      for (const row of rows) {
        if (!isImportablePppProfile(row.name)) continue;
        const normalized = normalizePaketProfileName(row.name);
        if (normalized) names.add(normalized);
      }
      readRouters.push({ id: router.id, nama: router.nama, userId: router.userId, names });
      const ownerNames = profilesByOwner.get(router.userId) ?? new Set<string>();
      for (const name of names) ownerNames.add(name);
      profilesByOwner.set(router.userId, ownerNames);
    } catch (err) {
      ownersWithFailedRouter.add(router.userId);
      failedRouters.push({ nama: router.nama });
      logger.warn({
        msg: "paket mikrotik presence router failed",
        routerId: router.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const ownerId of ownersWithFailedRouter) {
    profilesByOwner.delete(ownerId);
  }

  const paketRows = await prisma.paket.findMany({
    where: {
      deleted: false,
      ...(ownerScope != null ? { userId: ownerScope } : {}),
    },
    select: {
      id: true,
      nama: true,
      userId: true,
      pelanggan: {
        where: user.role === "Superadmin" ? undefined : { stop: false },
        select: { id: true },
      },
    },
  });

  for (const row of paketRows) {
    if (ownersWithFailedRouter.has(row.userId) || ownersWithRouter.has(row.userId)) {
      continue;
    }
    profilesByOwner.set(row.userId, new Set());
  }

  for (const router of readRouters) {
    const ids = paketRows
      .filter(
        (row) =>
          row.userId === router.userId &&
          router.names.has(normalizePaketProfileName(row.nama))
      )
      .map((row) => row.id);
    await replacePaketRouterLinks(router.id, router.userId, ids);
  }

  const classified = classifyPaketsMissingFromMikrotik({
    pakets: paketRows.map((row) => ({
      id: row.id,
      nama: row.nama,
      userId: row.userId,
      pelangganCount: row.pelanggan.length,
    })),
    profilesByOwner,
    ownersWithFailedRouter,
  });

  return {
    deletable: classified.deletable.map((row) => ({ id: row.id, nama: row.nama })),
    usedMissing: classified.usedMissing.map((row) => ({
      id: row.id,
      nama: row.nama,
      pelanggan: row.pelangganCount,
    })),
    failedRouters,
    placements: paketRows.map((row) => ({
      id: row.id,
      nama: row.nama,
      routers: routerNamesForPaket(row, readRouters),
      unchecked: ownersWithFailedRouter.has(row.userId),
    })),
  };
}

export async function scanPaketsMissingFromMikrotik(): Promise<
  PaketMissingFromMikrotikResult | { error: string }
> {
  try {
    return await readPaketMikrotikPresence();
  } catch (err) {
    logger.error({
      msg: "scanPaketsMissingFromMikrotik error",
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Gagal membaca profil dari Mikrotik" };
  }
}

export async function deleteUnusedPaketsMissingFromMikrotik(): Promise<
  { deleted: number } | { error: string }
> {
  try {
    const presence = await readPaketMikrotikPresence();
    if ("error" in presence) return presence;
    if (presence.deletable.length === 0) return { deleted: 0 };
    const result = await prisma.paket.updateMany({
      where: {
        id: { in: presence.deletable.map((row) => row.id) },
        deleted: false,
      },
      data: { deleted: true },
    });
    return { deleted: result.count };
  } catch (err) {
    logger.error({
      msg: "deleteUnusedPaketsMissingFromMikrotik error",
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Gagal menghapus paket" };
  }
}
