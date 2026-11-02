import prisma from "@/lib/prisma";
import { reconcileBerhentiPelangganAfterPppSync } from "@/lib/ppp-sync-berhenti-reconcile";
import {
  routerToCredentialsWithHostPolicy,
  withRouterOsClientPreflight,
} from "@/lib/routeros-session";
import {
  ROUTEROS_AUTH_FAILED_MSG,
  ROUTEROS_PROTOCOL_UNCERTAIN_MSG,
  ROUTEROS_SSL_REQUIRED_MSG,
  ROUTEROS_UNREACHABLE_MSG,
  userFacingRouterOsErrorMessage,
} from "@/lib/routeros-messages";
import { PPPActive, PPPSecret } from "@/lib/router-types";
import { logger } from "@/lib/logger";
import {
  poolsFromRouterPrint,
  profilesFromRouterPrint,
  rememberPppBackup,
  type PppBackupPool,
  type PppBackupProfile,
} from "@/lib/ppp-profile-backup";
import { Prisma, Service } from "@prisma/client";

const ROUTER_NOT_CONNECTED_MSG =
  "Router tidak terhubung. Periksa koneksi atau nyalakan MikroTik.";

export type PppSyncActor =
  | { userId: number; username: string }
  | "system";

export type PppSyncRouter = Prisma.RouterGetPayload<{
  include: { users: true };
}>;

export type PppSyncCoreSuccess = {
  ok: true;
  addTotal: number;
  secretsCreated: number;
  activesCreated: number;
  secretsUpdated: number;
  activesUpdated: number;
  syncTime: { id: number; routerId: number; updated: Date };
};

export type PppSyncCoreFailure = {
  ok: false;
  error: string;
};

export type PppSyncCoreResult = PppSyncCoreSuccess | PppSyncCoreFailure;

async function fetchPppSnapshotFromRouter(
  router: {
    host: string;
    port: number | null;
    user: string;
    password: string;
  },
  label: string
) {
  const creds = await routerToCredentialsWithHostPolicy(router);
  return withRouterOsClientPreflight(creds, label, async (api) => {
    const pppActive = (await api.write("/ppp/active/print")) as unknown as PPPActive[];
    const pppSecret = (await api.write("/ppp/secret/print")) as unknown as PPPSecret[];
    let profiles: PppBackupProfile[] | null = null;
    let pools: PppBackupPool[] | null = null;
    try {
      profiles = profilesFromRouterPrint(await api.write("/ppp/profile/print"));
    } catch (err) {
      logger.warn({
        msg: "Gagal membaca profil PPPoE saat sinkron",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      pools = poolsFromRouterPrint(await api.write("/ip/pool/print"));
    } catch (err) {
      logger.warn({
        msg: "Gagal membaca IP pool saat sinkron",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { pppActive, pppSecret, profiles, pools };
  });
}

function isExpectedRouterConnectError(err: Error & { code?: string }): boolean {
  const msg = err.message || "";
  return (
    msg === ROUTER_NOT_CONNECTED_MSG ||
    err.code === "ECONNREFUSED" ||
    err.code === "ETIMEDOUT" ||
    err.code === "ENOTFOUND" ||
    err.code === "ECONNRESET" ||
    err.code === "EHOSTUNREACH" ||
    err.code === "ENETUNREACH" ||
    err.code === "ROUTEROS_CONNECT_TIMEOUT" ||
    err.code === "ROUTEROS_UNREACHABLE" ||
    err.code === "ROUTEROS_AUTH_FAILED" ||
    err.code === "ROUTEROS_PROTOCOL_UNCERTAIN" ||
    err.code === "ROUTEROS_SSL_REQUIRED" ||
    err.code === "ROUTEROS_PROTOCOL_MISMATCH" ||
    err.code === "ROUTEROS_SOCKET_TIMEOUT" ||
    msg.toLowerCase().includes("econnrefused") ||
    msg.toLowerCase().includes("habis waktu") ||
    msg.toLowerCase().includes("protocol mismatch") ||
    msg === ROUTEROS_SSL_REQUIRED_MSG ||
    msg === ROUTEROS_PROTOCOL_UNCERTAIN_MSG ||
    msg === ROUTEROS_UNREACHABLE_MSG ||
    msg === ROUTEROS_AUTH_FAILED_MSG
  );
}

export function logPppRouterError(context: string, err: Error & { code?: string }): void {
  if (isExpectedRouterConnectError(err)) return;
  logger.error({ msg: context, error: err.message });
}

export function pppRouterConnectErrorMessage(
  error: Error & { code?: string }
): string {
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
  if (isExpectedRouterConnectError(error)) {
    return ROUTER_NOT_CONNECTED_MSG;
  }
  return userFacingRouterOsErrorMessage(error);
}

function actorForReconcile(actor: PppSyncActor) {
  if (actor === "system") {
    return { username: "system" };
  }
  return { userId: actor.userId, username: actor.username };
}

/** Full PPP sync — secrets + actives create/update/delete (manual + background). */
export async function runFullPppSyncCore(
  router: PppSyncRouter,
  label: string,
  actor: PppSyncActor
): Promise<PppSyncCoreResult> {
  try {
    const { pppActive, pppSecret, profiles, pools } = await fetchPppSnapshotFromRouter(
      router,
      label
    );
    await rememberPppBackup(router.id, { profiles, pools });

    const existingSecrets = await prisma.pppSecret.findMany({
      where: { routerId: router.id },
    });
    const existingActives = await prisma.pppActive.findMany({
      where: { routerId: router.id },
    });

    const existingSecretNames = new Set(existingSecrets.map((s) => s.name));
    const existingActiveNames = new Set(existingActives.map((a) => a.name));
    const existingActiveNamesSync = new Set(pppActive.map((a) => a.name));

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
    const activesToDelete = existingActives.filter(
      (val) => !existingActiveNamesSync.has(val.name)
    );

    const secretCreateData: Prisma.PppSecretCreateManyInput[] =
      secretsToCreate.map((val) => ({
        callerId: val["caller-id"],
        comment: val.comment,
        disabled: val.disabled,
        ipv6_routes: val["ipv6-routes"],
        last_callerId: val["last-caller-id"],
        last_disconnect_reason: val["last-disconnect-reason"],
        last_logged_out: val["last-logged-out"],
        limit_bytes_in: val["limit-bytes-in"],
        limit_bytes_out: val["limit-bytes-out"],
        name: val.name,
        password: val.password,
        profile: val.profile,
        routerId: router.id,
        routes: val.routes,
        secretId: val[".id"],
        service: val.service as Service,
        on_router: true,
      }));

    const secretUpdatePromises = secretsToUpdate.map((val) => {
      const existing = existingSecrets.find((s) => s.name === val.name);
      const isolirProfile = router.isolirProfileName?.trim();
      const onIsolirProfile =
        isolirProfile != null && val.profile === isolirProfile;

      return prisma.pppSecret.update({
        where: { routerId_name: { routerId: router.id, name: val.name } },
        data: {
          callerId: val["caller-id"],
          comment: val.comment,
          disabled: val.disabled,
          ipv6_routes: val["ipv6-routes"],
          last_callerId: val["last-caller-id"],
          last_disconnect_reason: val["last-disconnect-reason"],
          last_logged_out: val["last-logged-out"],
          limit_bytes_in: val["limit-bytes-in"],
          limit_bytes_out: val["limit-bytes-out"],
          password: val.password,
          profile: val.profile,
          routes: val.routes,
          secretId: val[".id"],
          service: val.service as Service,
          on_router: true,
          isIsolir: onIsolirProfile,
          profileBeforeIsolir: onIsolirProfile
            ? (existing?.profileBeforeIsolir ??
              (existing?.profile &&
              existing.profile !== isolirProfile
                ? existing.profile
                : null))
            : null,
        } as Prisma.PppSecretUpdateInput,
      });
    });

    const secretsMissingFromRouter = existingSecrets.filter(
      (val) => !pppSecret.some((p) => p.name === val.name)
    );
    const secretMissingUpdatePromises = secretsMissingFromRouter.map((val) =>
      prisma.pppSecret.update({
        where: { id: val.id },
        data: { on_router: false } as Prisma.PppSecretUpdateInput,
      })
    );

    const activeCreateData = [];
    for (const val of activesToCreate) {
      const secret = existingSecrets.find((sVal) => sVal.name === val.name);
      if (!secret) continue;

      activeCreateData.push({
        activeId: val[".id"],
        address: val.address,
        callerId: val["caller-id"],
        comment: val.comment,
        encoding: val.encoding,
        limit_bytes_in: val["limit-bytes-in"],
        limit_bytes_out: val["limit-bytes-out"],
        name: val.name,
        radius: val.radius,
        routerId: router.id,
        service: val.service as Service,
        sessionId: val["session-id"],
        uptime: val.uptime,
      });
    }

    const activeUpdatePromises = activesToUpdate.map((val) =>
      prisma.pppActive.update({
        where: { routerId_name: { routerId: router.id, name: val.name } },
        data: {
          activeId: val[".id"],
          address: val.address,
          callerId: val["caller-id"],
          comment: val.comment,
          encoding: val.encoding,
          limit_bytes_in: val["limit-bytes-in"],
          limit_bytes_out: val["limit-bytes-out"],
          radius: val.radius,
          service: val.service as Service,
          sessionId: val["session-id"],
          uptime: val.uptime,
        },
      })
    );

    const activeDeletePromises = [];
    for (const val of activesToDelete) {
      const secret = existingSecrets.find((sVal) => sVal.name === val.name);
      if (!secret) continue;
      activeDeletePromises.push(
        prisma.pppActive.delete({
          where: { routerId_name: { routerId: router.id, name: val.name } },
        })
      );
    }

    await prisma.$transaction([
      prisma.pppSecret.createMany({
        data: secretCreateData,
        skipDuplicates: true,
      }),
      prisma.pppActive.createMany({
        data: activeCreateData,
        skipDuplicates: true,
      }),
      ...secretUpdatePromises,
      ...secretMissingUpdatePromises,
      ...activeUpdatePromises,
      ...activeDeletePromises,
    ]);

    if (router.userId) {
      await reconcileBerhentiPelangganAfterPppSync({
        routerId: router.id,
        mitraUserId: router.userId,
        mikrotikSecrets: pppSecret,
        actor: actorForReconcile(actor),
      });
    }

    const syncTime = await prisma.pppSync.upsert({
      where: { routerId: router.id },
      create: { routerId: router.id },
      update: { routerId: router.id, updated: new Date() },
    });

    return {
      ok: true,
      addTotal: secretsToCreate.length || 0,
      secretsCreated: secretCreateData.length,
      activesCreated: activeCreateData.length,
      secretsUpdated: secretsToUpdate.length,
      activesUpdated: activesToUpdate.length,
      syncTime,
    };
  } catch (err) {
    const error = err as Error & { code?: string };
    logPppRouterError(`${label} error`, error);
    return { ok: false, error: pppRouterConnectErrorMessage(error) };
  }
}

/** Realtime PPP sync — incremental create/delete (auto sync on page open). */
export async function runRealtimePppSyncCore(
  router: PppSyncRouter,
  label: string,
  actor: PppSyncActor
): Promise<PppSyncCoreResult> {
  try {
    const { pppActive, pppSecret, profiles, pools } = await fetchPppSnapshotFromRouter(
      router,
      label
    );
    await rememberPppBackup(router.id, { profiles, pools });

    const existingSecrets = await prisma.pppSecret.findMany({
      where: { routerId: router.id },
    });
    if (existingSecrets.length === 0) {
      return { ok: false, error: "Belum sinkron awal" };
    }
    const existingActives = await prisma.pppActive.findMany({
      where: { routerId: router.id },
    });

    const existingSecretNames = new Set(existingSecrets.map((s) => s.name));
    const existingActiveNames = new Set(existingActives.map((a) => a.name));
    const existingActiveNamesSync = new Set(pppActive.map((a) => a.name));

    const secretsToCreate = pppSecret.filter(
      (val) => !existingSecretNames.has(val.name)
    );

    const activesToCreate = pppActive.filter(
      (val) => !existingActiveNames.has(val.name)
    );
    const activesToDelete = existingActives.filter(
      (val) => !existingActiveNamesSync.has(val.name)
    );

    const secretCreateData = secretsToCreate.map((val) => ({
      callerId: val["caller-id"],
      comment: val.comment,
      disabled: val.disabled,
      ipv6_routes: val["ipv6-routes"],
      last_callerId: val["last-caller-id"],
      last_disconnect_reason: val["last-disconnect-reason"],
      last_logged_out: val["last-logged-out"],
      limit_bytes_in: val["limit-bytes-in"],
      limit_bytes_out: val["limit-bytes-out"],
      name: val.name,
      password: val.password,
      profile: val.profile,
      routerId: router.id,
      routes: val.routes,
      secretId: val[".id"],
      service: val.service,
      on_router: true,
    }));

    const secretsMissingFromRouter = existingSecrets.filter(
      (val) => !pppSecret.some((p) => p.name === val.name)
    );
    const secretMissingUpdatePromises = secretsMissingFromRouter.map((val) =>
      prisma.pppSecret.update({
        where: { id: val.id },
        data: { on_router: false },
      })
    );

    const secretsFound = existingSecrets.filter(
      (val) =>
        pppSecret.some((p) => p.name === val.name) && val.on_router === false
    );
    const secretFoundUpdatePromises = secretsFound.map((val) =>
      prisma.pppSecret.update({
        where: { id: val.id },
        data: { on_router: true },
      })
    );

    const activeCreateData = [];
    for (const val of activesToCreate) {
      const secret = existingSecrets.find((sVal) => sVal.name === val.name);
      if (!secret) continue;

      activeCreateData.push({
        activeId: val[".id"],
        address: val.address,
        callerId: val["caller-id"],
        comment: val.comment,
        encoding: val.encoding,
        limit_bytes_in: val["limit-bytes-in"],
        limit_bytes_out: val["limit-bytes-out"],
        name: val.name,
        radius: val.radius,
        routerId: router.id,
        service: val.service,
        sessionId: val["session-id"],
        uptime: val.uptime,
      });
    }

    const activeDeletePromises = [];
    for (const val of activesToDelete) {
      const secret = existingSecrets.find((sVal) => sVal.name === val.name);
      if (!secret) continue;
      activeDeletePromises.push(
        prisma.pppActive.delete({
          where: { routerId_name: { routerId: router.id, name: val.name } },
        })
      );
    }

    await prisma.$transaction([
      prisma.pppSecret.createMany({
        data: secretCreateData,
        skipDuplicates: true,
      }),
      ...secretMissingUpdatePromises,
      ...secretFoundUpdatePromises,
      prisma.pppActive.createMany({
        data: activeCreateData,
        skipDuplicates: true,
      }),
      ...activeDeletePromises,
    ]);

    if (router.userId) {
      await reconcileBerhentiPelangganAfterPppSync({
        routerId: router.id,
        mitraUserId: router.userId,
        mikrotikSecrets: pppSecret,
        actor: actorForReconcile(actor),
      });
    }

    const syncTime = await prisma.pppSync.upsert({
      where: { routerId: router.id },
      create: { routerId: router.id },
      update: { routerId: router.id, updated: new Date() },
    });

    return {
      ok: true,
      addTotal: secretsToCreate.length || 0,
      secretsCreated: secretCreateData.length,
      activesCreated: activeCreateData.length,
      secretsUpdated: 0,
      activesUpdated: 0,
      syncTime,
    };
  } catch (err) {
    const error = err as Error & { code?: string };
    logPppRouterError(`${label} error`, error);
    return { ok: false, error: pppRouterConnectErrorMessage(error) };
  }
}

export async function loadPppSyncRouter(
  routerId: number
): Promise<PppSyncRouter | null> {
  return prisma.router.findUnique({
    where: { id: routerId },
    include: { users: true },
  });
}

export function isRouterEligibleForBackgroundSync(
  router: Pick<RouterRow, "deleted" | "host" | "port" | "user" | "password">
): boolean {
  if (router.deleted) return false;
  if (!router.host?.trim()) return false;
  if (!router.user?.trim()) return false;
  if (!router.password?.trim()) return false;
  if (router.port == null || router.port <= 0) return false;
  return true;
}

type RouterRow = {
  deleted: boolean;
  host: string;
  port: number | null;
  user: string;
  password: string;
};

export { fetchPppSnapshotFromRouter };
