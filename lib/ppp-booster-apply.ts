import { boosterEndsAt } from "@/lib/ppp-booster";
import { listPackageChangeTargets } from "@/lib/ppp-package-change";
import { isPppIsolir } from "@/lib/ppp-isolir";
import { loadRouterCredentials, type RouterCredentials } from "@/lib/ppp-isolir-service";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { PPPActive } from "@/lib/router-types";
import type { RouterOSClient } from "@/lib/routeros-client";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";

type BoosterSecret = {
  id: number;
  name: string;
  on_router: boolean;
  isIsolir: boolean;
  disabled: string;
  profile: string;
  profileBeforeIsolir: string | null;
};

type BoosterPelanggan = {
  id: number;
  stop: boolean;
  paket: {
    id: number;
    nama: string;
    kapasitas: number;
    harga: number;
  };
};

type BoosterTarget = {
  id: number;
  nama: string;
  kapasitas: number;
  harga: number;
};

export type ApplyPppBoosterResult =
  | {
      ok: true;
      profile: string;
      previousProfile: string;
      kicked: boolean;
      kickPermissionDenied: boolean;
      days: number;
      endsAt: Date;
    }
  | { ok: false; error: string };

function isPermissionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /permission|not enough permissions|access denied/i.test(message);
}

async function readProfileNames(api: RouterOSClient): Promise<string[]> {
  const rows = (await api.write("/ppp/profile/print")) as unknown as { name?: string }[];
  return rows.map((row) => row.name?.trim() ?? "").filter(Boolean);
}

async function setSecretProfile(
  api: RouterOSClient,
  pppName: string,
  profile: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const printed = (await api.write(["/ppp/secret/print", `?name=${pppName}`])) as {
    ".id"?: string;
    profile?: string;
  }[];
  const row = printed.at(0);
  if (!row?.[".id"]) {
    return { ok: false, error: "PPP tidak ditemukan di Mikrotik" };
  }
  await api.write(["/ppp/secret/set", `=.id=${row[".id"]}`, `=profile=${profile}`]);
  const check = (await api.write(["/ppp/secret/print", `?name=${pppName}`])) as {
    profile?: string;
  }[];
  const applied = check.at(0)?.profile?.trim().toLowerCase();
  if (applied !== profile.trim().toLowerCase()) {
    return { ok: false, error: "Profil di Mikrotik belum berubah" };
  }
  return { ok: true };
}

async function kickActiveSession(
  api: RouterOSClient,
  pppName: string
): Promise<{ kicked: boolean; permissionDenied: boolean }> {
  try {
    const actives = (await api.write([
      "/ppp/active/print",
      `?name=${pppName}`,
    ])) as unknown as PPPActive[];
    const active = actives.find((row) => row.name === pppName);
    if (!active?.[".id"]) return { kicked: false, permissionDenied: false };
    await api.write(["/ppp/active/remove", `=.id=${active[".id"]}`]);
    return { kicked: true, permissionDenied: false };
  } catch (err) {
    logger.warn({ msg: "kick ppp active failed", pppName, error: err });
    return { kicked: false, permissionDenied: isPermissionError(err) };
  }
}

export async function applyPppBooster(params: {
  router: RouterCredentials;
  ownerUserId: number;
  secret: BoosterSecret;
  pelanggan: BoosterPelanggan;
  target: BoosterTarget;
  days: number;
  actorUserId: number;
}): Promise<ApplyPppBoosterResult> {
  const { router, secret, pelanggan, target, days, actorUserId } = params;
  const endsAt = boosterEndsAt(days);
  if (!endsAt) {
    return { ok: false, error: "Pilih lama booster 1 sampai 6 hari." };
  }
  if (!secret.on_router) {
    return { ok: false, error: "PPP ini tidak ada di Mikrotik" };
  }
  if (pelanggan.stop) {
    return { ok: false, error: "Pelanggan berhenti. Aktifkan dulu sebelum booster." };
  }
  if (isPppIsolir(secret, { isolirProfileName: router.isolirProfileName })) {
    return { ok: false, error: "Buka isolir dulu sebelum booster." };
  }

  const pakets = await prisma.paket.findMany({
    where: { userId: params.ownerUserId, deleted: false },
    select: { id: true, nama: true, kapasitas: true, harga: true },
  });

  const active = await prisma.pppBooster.findFirst({
    where: { pppSecretId: secret.id, restoredAt: null },
    orderBy: { created: "desc" },
    select: { id: true, previousProfile: true },
  });
  const previousProfile = active?.previousProfile?.trim() || secret.profile;

  try {
    return await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `ppp-booster:${router.id}:${secret.name}`,
      async (api) => {
        const routerProfiles = await readProfileNames(api);
        const allowed = listPackageChangeTargets({
          direction: "upgrade",
          current: pelanggan.paket,
          pakets,
          routerProfiles,
          isolirProfileName: router.isolirProfileName,
        });
        const chosen = allowed.find((row) => row.id === target.id);
        if (!chosen) {
          return {
            ok: false as const,
            error: "Profil itu bukan booster dari profil yang ada di Mikrotik",
          };
        }

        const setResult = await setSecretProfile(api, secret.name, chosen.profile);
        if (!setResult.ok) return { ok: false as const, error: setResult.error };

        const kick = await kickActiveSession(api, secret.name);
        if (!kick.kicked && kick.permissionDenied) {
          logger.warn({
            msg: "Profil booster berubah, sesi aktif tidak bisa diputus",
            routerId: router.id,
            pppName: secret.name,
          });
        }

        await prisma.$transaction(async (tx) => {
          await tx.pppSecret.update({
            where: { id: secret.id },
            data: { profile: chosen.profile },
          });
          if (kick.kicked) {
            await tx.pppActive.deleteMany({
              where: { routerId: router.id, name: secret.name },
            });
          }
          if (active) {
            await tx.pppBooster.update({
              where: { id: active.id },
              data: {
                previousProfile,
                boosterProfile: chosen.profile,
                days,
                endsAt,
                actorUserId,
              },
            });
            await tx.pppBooster.updateMany({
              where: {
                pppSecretId: secret.id,
                restoredAt: null,
                id: { not: active.id },
              },
              data: { restoredAt: new Date() },
            });
          } else {
            await tx.pppBooster.create({
              data: {
                pppSecretId: secret.id,
                routerId: router.id,
                previousProfile,
                boosterProfile: chosen.profile,
                days,
                endsAt,
                actorUserId,
              },
            });
          }
        });

        return {
          ok: true as const,
          profile: chosen.profile,
          previousProfile,
          kicked: kick.kicked,
          kickPermissionDenied: kick.permissionDenied,
          days,
          endsAt,
        };
      }
    );
  } catch (err) {
    logger.warn({
      msg: "applyPppBooster failed",
      routerId: router.id,
      pppName: secret.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal mengubah profil di Mikrotik",
    };
  }
}

export async function restoreExpiredPppBoosters(routerId?: number): Promise<{
  restored: number;
  skipped: number;
  failed: number;
}> {
  const now = new Date();
  const due = await prisma.pppBooster.findMany({
    where: {
      restoredAt: null,
      endsAt: { lte: now },
      ...(routerId != null ? { routerId } : {}),
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      routerId: true,
      previousProfile: true,
      pppSecret: {
        select: {
          id: true,
          name: true,
          profile: true,
          isIsolir: true,
          profileBeforeIsolir: true,
          disabled: true,
          on_router: true,
        },
      },
    },
  });

  let restored = 0;
  let skipped = 0;
  let failed = 0;
  const byRouter = new Map<number, typeof due>();
  for (const row of due) {
    const list = byRouter.get(row.routerId) ?? [];
    list.push(row);
    byRouter.set(row.routerId, list);
  }

  for (const [id, rows] of byRouter) {
    const creds = await loadRouterCredentials(id);
    const actionable: typeof rows = [];
    for (const row of rows) {
      if (!row.pppSecret.on_router) {
        await prisma.pppBooster.update({
          where: { id: row.id },
          data: { restoredAt: now },
        });
        restored += 1;
        continue;
      }
      if (
        isPppIsolir(row.pppSecret, { isolirProfileName: creds?.isolirProfileName })
      ) {
        skipped += 1;
        continue;
      }
      actionable.push(row);
    }
    if (actionable.length === 0) continue;
    if (!creds) {
      failed += actionable.length;
      continue;
    }

    try {
      await withRouterOsClient(
        await routerToCredentialsWithHostPolicy(creds),
        `ppp-booster-restore:${id}`,
        async (api) => {
          for (const row of actionable) {
            const setResult = await setSecretProfile(
              api,
              row.pppSecret.name,
              row.previousProfile
            );
            if (!setResult.ok) {
              failed += 1;
              logger.warn({
                msg: "restore ppp booster profile failed",
                routerId: id,
                pppName: row.pppSecret.name,
                error: setResult.error,
              });
              continue;
            }
            const kick = await kickActiveSession(api, row.pppSecret.name);
            await prisma.$transaction(async (tx) => {
              await tx.pppSecret.update({
                where: { id: row.pppSecret.id },
                data: { profile: row.previousProfile },
              });
              if (kick.kicked) {
                await tx.pppActive.deleteMany({
                  where: { routerId: id, name: row.pppSecret.name },
                });
              }
              await tx.pppBooster.update({
                where: { id: row.id },
                data: { restoredAt: new Date() },
              });
            });
            restored += 1;
          }
        }
      );
    } catch (err) {
      failed += actionable.length;
      logger.warn({
        msg: "restore ppp booster router failed",
        routerId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { restored, skipped, failed };
}
