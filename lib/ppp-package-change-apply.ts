import { listPackageChangeTargets, type PackageChangeDirection } from "@/lib/ppp-package-change";
import { isPppIsolir } from "@/lib/ppp-isolir";
import { resolveIsFreeCustomerForPaket } from "@/lib/pelanggan-billing-category";
import { logActivityEvent } from "@/lib/activity-audit-log";
import { formatIsolirActor } from "@/lib/isolir-actor-label";
import { tagihanTotalFromPaket } from "@/lib/paket-persist";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { RoleName } from "@prisma/client";
import type { RouterOSClient } from "@/lib/routeros-client";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";
import type { PPPActive } from "@/lib/router-types";
import type { RouterCredentials } from "@/lib/ppp-isolir-service";

type ApplySecret = {
  id: number;
  name: string;
  on_router: boolean;
  isIsolir: boolean;
  disabled: string;
  profile: string;
  profileBeforeIsolir: string | null;
};

type ApplyPelanggan = {
  id: number;
  nama: string;
  stop: boolean;
  paket: {
    id: number;
    nama: string;
    kapasitas: number;
    harga: number;
  };
};

type ApplyPaket = {
  id: number;
  nama: string;
  kapasitas: number;
  harga: number;
};

export type ApplyPppPackageChangeResult =
  | {
      ok: true;
      profile: string;
      kicked: boolean;
      kickPermissionDenied: boolean;
      paket: ApplyPaket;
    }
  | { ok: false; error: string };

function isPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("not enough permissions");
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

export async function applyPppPackageChange(params: {
  router: RouterCredentials;
  ownerUserId: number;
  secret: ApplySecret;
  pelanggan: ApplyPelanggan;
  target: ApplyPaket;
  direction: PackageChangeDirection;
  actor?: {
    id: number;
    role: RoleName;
    nama?: string | null;
    user?: string | null;
  } | null;
}): Promise<ApplyPppPackageChangeResult> {
  const { router, secret, pelanggan, target, direction } = params;
  if (!secret.on_router) {
    return { ok: false, error: "PPP ini tidak ada di Mikrotik" };
  }
  if (pelanggan.stop) {
    return { ok: false, error: "Pelanggan berhenti. Aktifkan dulu sebelum ganti paket." };
  }
  if (
    isPppIsolir(secret, { isolirProfileName: router.isolirProfileName })
  ) {
    return { ok: false, error: "Buka isolir dulu sebelum ganti profil dan paket." };
  }

  const [pakets, owner] = await Promise.all([
    prisma.paket.findMany({
      where: { userId: params.ownerUserId, deleted: false },
      select: {
        id: true,
        nama: true,
        kapasitas: true,
        harga: true,
        nominalPembayaran: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: params.ownerUserId },
      select: { ppn: true },
    }),
  ]);
  const ppnPercent = owner?.ppn ?? 11;

  try {
    return await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `ppp-paket:${router.id}:${secret.name}`,
      async (api) => {
        const routerProfiles = await readProfileNames(api);
        const allowed = listPackageChangeTargets({
          direction,
          current: pelanggan.paket,
          pakets,
          routerProfiles,
          isolirProfileName: router.isolirProfileName,
        });
        const chosen = allowed.find((row) => row.id === target.id);
        if (!chosen) {
          return {
            ok: false as const,
            error:
              direction === "upgrade"
                ? "Paket itu bukan upgrade dari profil yang ada di Mikrotik"
                : "Paket itu bukan downgrade dari profil yang ada di Mikrotik",
          };
        }
        const nextTotal = tagihanTotalFromPaket(chosen, ppnPercent);

        const setResult = await setSecretProfile(api, secret.name, chosen.profile);
        if (!setResult.ok) return { ok: false as const, error: setResult.error };

        const kick = await kickActiveSession(api, secret.name);
        if (!kick.kicked && kick.permissionDenied) {
          logger.warn({
            msg: "Profil PPP berubah, sesi aktif tidak bisa diputus",
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
          await tx.pelanggan.update({
            where: { id: pelanggan.id },
            data: {
              paketId: chosen.id,
              isFreeCustomer: resolveIsFreeCustomerForPaket(chosen.harga),
            },
          });
          await tx.pembayaran.updateMany({
            where: {
              pelangganId: pelanggan.id,
              status: "Belum",
            },
            data: {
              paketId: chosen.id,
              total: nextTotal,
            },
          });
          await tx.pppBooster.updateMany({
            where: { pppSecretId: secret.id, restoredAt: null },
            data: { restoredAt: new Date() },
          });
          if (params.actor && params.actor.role !== "Superadmin") {
            await tx.pppPackageChange.create({
              data: {
                pppSecretId: secret.id,
                pelangganId: pelanggan.id,
                routerId: router.id,
                ownerUserId: params.ownerUserId,
                actorUserId: params.actor.id,
                actorRole: params.actor.role,
                direction,
              },
            });
          }
        });

        logActivityEvent({
          action: "ppp_package_changed",
          userId: params.ownerUserId,
          username: params.actor ? formatIsolirActor(params.actor) : undefined,
          reason: [
            pelanggan.nama.trim(),
            secret.name,
            `${pelanggan.paket.nama} → ${chosen.nama}`,
          ]
            .filter(Boolean)
            .join(" · "),
          meta: {
            routerId: router.id,
            pelangganId: pelanggan.id,
            pppSecretId: secret.id,
            direction,
            actorUserId: params.actor?.id ?? null,
          },
        });

        return {
          ok: true as const,
          profile: chosen.profile,
          kicked: kick.kicked,
          kickPermissionDenied: kick.permissionDenied,
          paket: {
            id: chosen.id,
            nama: chosen.nama,
            kapasitas: chosen.kapasitas,
            harga: chosen.harga,
          },
        };
      }
    );
  } catch (err) {
    logger.warn({
      msg: "applyPppPackageChange failed",
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
