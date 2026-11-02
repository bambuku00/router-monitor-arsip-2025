import { isPppIsolir } from "@/lib/ppp-isolir";
import { ensureTagihanAfterRestoreIsolir } from "@/lib/jobs/generate-payments";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";
import type { RouterOSClient } from "@/lib/routeros-client";
import { PPPActive } from "@/lib/router-types";
import type { Prisma } from "@prisma/client";

export type RouterCredentials = {
  id: number;
  host: string;
  port: number;
  user: string;
  password: string;
  isolirProfileName: string | null;
};

export type PppIsolirSecret = {
  name: string;
  profile: string;
  disabled: string;
  isIsolir: boolean;
  profileBeforeIsolir: string | null;
  active_records: { activeId: string } | null;
};

export type IsolirOperationResult = {
  ok: boolean;
  permissionDenied?: boolean;
  oldProfile?: string;
  newProfile?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
};

function isPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("not enough permissions");
}

async function tagihanAfterBukaIsolir(routerId: number, pppName: string) {
  try {
    await ensureTagihanAfterRestoreIsolir({ routerId, pppName });
  } catch (err) {
    logger.warn({
      msg: "Gagal buat tagihan setelah buka isolir",
      routerId,
      pppName,
      error: err,
    });
  }
}

export function resolveIsolirProfileName(
  routerIsolirProfile: string | null | undefined,
  settingsProfile?: string | null
): string | null {
  const fromRouter = routerIsolirProfile?.trim();
  if (fromRouter) return fromRouter;
  const fromSettings = settingsProfile?.trim();
  return fromSettings || null;
}

/** Pure resolver — dipakai restore isolir & unit test. */
export function pickRestoreProfile(params: {
  profileBeforeIsolir?: string | null;
  paketNama?: string | null;
  isolirProfileName?: string | null;
}): string | null {
  const saved = params.profileBeforeIsolir?.trim();
  if (saved) return saved;

  const fromPaket = params.paketNama?.trim();
  if (!fromPaket) return null;

  const isolirProfile = params.isolirProfileName?.trim();
  if (isolirProfile && fromPaket === isolirProfile) return null;

  return fromPaket;
}

/** Profil PPP sebelum isolir — dari DB atau fallback nama paket pelanggan. */
export async function resolveProfileBeforeIsolir(params: {
  routerId: number;
  ppp: Pick<PppIsolirSecret, "name" | "profileBeforeIsolir">;
  isolirProfileName?: string | null;
}): Promise<string | null> {
  const pelanggan = await prisma.pelanggan.findFirst({
    where: {
      ppp_secret: {
        is: { routerId: params.routerId, name: params.ppp.name },
      },
    },
    select: { paket: { select: { nama: true } } },
  });

  return pickRestoreProfile({
    profileBeforeIsolir: params.ppp.profileBeforeIsolir,
    paketNama: pelanggan?.paket?.nama,
    isolirProfileName: params.isolirProfileName,
  });
}

/** Cocokkan nama profil kandidat dengan daftar profil di Mikrotik (case-insensitive). */
export function matchProfileOnRouter(
  candidates: (string | null | undefined)[],
  routerProfiles: string[]
): string | null {
  if (routerProfiles.length === 0) return null;
  const byLower = new Map<string, string>();
  for (const p of routerProfiles) {
    const trimmed = p.trim();
    if (trimmed) byLower.set(trimmed.toLowerCase(), trimmed);
  }
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (!trimmed) continue;
    const hit = byLower.get(trimmed.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

async function fetchRouterPppProfileNames(
  api: RouterOSClient
): Promise<string[]> {
  try {
    const rows = (await api.write("/ppp/profile/print")) as unknown as {
      name?: string;
    }[];
    return rows
      .map((r) => r.name?.trim())
      .filter((n): n is string => Boolean(n));
  } catch (err) {
    logger.warn({ msg: "fetchRouterPppProfileNames failed", error: err });
    return [];
  }
}

async function readPppSecretProfile(
  api: RouterOSClient,
  pppName: string
): Promise<{ profile: string } | null> {
  const pppData = await api.write(["/ppp/secret/print", `?name=${pppName}`]);
  const row = pppData.at(0) as Record<string, string> | undefined;
  const profile = row?.profile?.trim();
  if (!profile) return null;
  return { profile };
}

async function verifyPppProfileSet(
  api: RouterOSClient,
  pppName: string,
  expectedProfile: string
): Promise<boolean> {
  const row = await readPppSecretProfile(api, pppName);
  if (!row) return false;
  return row.profile.toLowerCase() === expectedProfile.trim().toLowerCase();
}

async function setPppProfileOnMikrotik(
  api: RouterOSClient,
  pppName: string,
  profile: string
): Promise<{ ok: boolean; permissionDenied: boolean; error?: string }> {
  try {
    const pppData = await api.write(["/ppp/secret/print", `?name=${pppName}`]);
    const id = (pppData.at(0) as Record<string, string> | undefined)?.[".id"];
    if (!id) {
      return { ok: false, permissionDenied: false, error: "PPP tidak ditemukan di router" };
    }
    await api.write([
      "/ppp/secret/set",
      `=.id=${id}`,
      `=profile=${profile}`,
      "=disabled=no",
    ]);
    return { ok: true, permissionDenied: false };
  } catch (err) {
    logger.warn({ msg: "setPppProfileOnMikrotik failed", pppName, error: err });
    return {
      ok: false,
      permissionDenied: isPermissionError(err),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function removePppActiveSession(
  api: RouterOSClient,
  pppName: string
): Promise<{ permissionDenied: boolean }> {
  let permissionDenied = false;
  try {
    const pppActives = (await api.write(
      "/ppp/active/print"
    )) as unknown as PPPActive[];
    const active = pppActives.find((val) => val.name === pppName);
    if (active) {
      await api.write(["/ppp/active/remove", `=.id=${active[".id"]}`]);
    }
  } catch (err) {
    logger.warn({ msg: "removePppActiveSession failed", pppName, error: err });
    if (isPermissionError(err)) permissionDenied = true;
  }
  return { permissionDenied };
}

/** Terapkan isolir: ganti profile PPP ke profil isolir, simpan backup di DB. */
export async function isolateCustomer(params: {
  router: RouterCredentials;
  ppp: PppIsolirSecret;
  isolirProfileOverride?: string | null;
  dryRun?: boolean;
}): Promise<IsolirOperationResult> {
  const { router, ppp, dryRun } = params;
  const isolirProfile = resolveIsolirProfileName(
    router.isolirProfileName,
    params.isolirProfileOverride
  );

  if (isPppIsolir(ppp, { isolirProfileName: isolirProfile })) {
    return {
      ok: true,
      skipped: true,
      skipReason: "Sudah dalam status isolir",
      oldProfile: ppp.profile,
      newProfile: ppp.profile,
    };
  }

  if (!isolirProfile) {
    return {
      ok: false,
      error: "Profil isolir belum dikonfigurasi (setup router atau pengaturan auto isolir)",
    };
  }

  const backupProfile =
    ppp.profile !== isolirProfile
      ? ppp.profile
      : (ppp.profileBeforeIsolir ??
        (await resolveProfileBeforeIsolir({
          routerId: router.id,
          ppp,
          isolirProfileName: isolirProfile,
        })));

  if (dryRun) {
    return {
      ok: true,
      oldProfile: ppp.profile,
      newProfile: isolirProfile,
    };
  }

  try {
    return await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `isolate:${router.id}:${ppp.name}`,
      async (api) => {
        const secretOnRouter = await readPppSecretProfile(api, ppp.name);
        if (!secretOnRouter) {
          return { ok: false, error: "PPP tidak ditemukan di router" };
        }

        const routerProfiles = await fetchRouterPppProfileNames(api);
        const isolirMatched = matchProfileOnRouter(
          [isolirProfile],
          routerProfiles
        );
        if (!isolirMatched) {
          return {
            ok: false,
            error: `Profil isolir "${isolirProfile}" tidak ada di Mikrotik. Jalankan Setup Isolir terlebih dahulu.`,
          };
        }

        let backup =
          secretOnRouter.profile !== isolirMatched
            ? secretOnRouter.profile
            : backupProfile;
        if (!backup || backup.toLowerCase() === isolirMatched.toLowerCase()) {
          backup =
            (await resolveProfileBeforeIsolir({
              routerId: router.id,
              ppp,
              isolirProfileName: isolirProfile,
            })) ?? null;
        }
        if (!backup || backup.toLowerCase() === isolirMatched.toLowerCase()) {
          return {
            ok: false,
            error:
              "Profil sebelum isolir tidak diketahui. Pastikan paket pelanggan terisi dan profil PPP ada di Mikrotik.",
          };
        }

        const setResult = await setPppProfileOnMikrotik(
          api,
          ppp.name,
          isolirMatched
        );
        if (!setResult.ok && !setResult.permissionDenied) {
          return { ok: false, error: setResult.error ?? "Gagal mengubah profil di Mikrotik" };
        }

        const removeResult = await removePppActiveSession(api, ppp.name);
        const permissionDenied =
          setResult.permissionDenied || removeResult.permissionDenied;

        await prisma.$transaction(async (tx) => {
          await tx.pppSecret.update({
            where: { routerId_name: { routerId: router.id, name: ppp.name } },
            data: {
              profile: isolirMatched,
              profileBeforeIsolir: backup,
              isIsolir: true,
              disabled: "false",
            },
          });
          await tx.pppActive.deleteMany({
            where: { routerId: router.id, name: ppp.name },
          });
        });

        return {
          ok: true,
          permissionDenied,
          oldProfile: ppp.profile,
          newProfile: isolirMatched,
        };
      }
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Buka isolir: kembalikan profile dari backup. */
export async function restoreCustomer(params: {
  router: RouterCredentials;
  ppp: PppIsolirSecret;
  dryRun?: boolean;
}): Promise<IsolirOperationResult> {
  const { router, ppp, dryRun } = params;
  const isolirProfile = router.isolirProfileName?.trim();

  if (!isPppIsolir(ppp, { isolirProfileName: isolirProfile })) {
    return {
      ok: true,
      skipped: true,
      skipReason: "Tidak dalam status isolir",
      oldProfile: ppp.profile,
      newProfile: ppp.profile,
    };
  }

  if (!ppp.profileBeforeIsolir && ppp.disabled === "true") {
    if (dryRun) {
      return { ok: true, oldProfile: ppp.profile, newProfile: ppp.profile };
    }
    return restoreLegacyDisabledIsolir(router, ppp);
  }

  const restoreProfile = await resolveProfileBeforeIsolir({
    routerId: router.id,
    ppp,
    isolirProfileName: isolirProfile,
  });

  if (!restoreProfile) {
    return {
      ok: false,
      error: "Profil sebelum isolir tidak ditemukan di database",
    };
  }

  if (dryRun) {
    return {
      ok: true,
      oldProfile: ppp.profile,
      newProfile: restoreProfile,
    };
  }

  try {
    return await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `restore:${router.id}:${ppp.name}`,
      async (api) => {
        const routerProfiles = await fetchRouterPppProfileNames(api);
        const matchedRestore = matchProfileOnRouter(
          [restoreProfile],
          routerProfiles
        );
        if (!matchedRestore) {
          return {
            ok: false,
            error: `Profil "${restoreProfile}" tidak ada di Mikrotik. Nama profil PPP di router harus sama dengan profil/paket pelanggan.`,
          };
        }

        const setResult = await setPppProfileOnMikrotik(
          api,
          ppp.name,
          matchedRestore
        );
        if (!setResult.ok) {
          return {
            ok: false,
            permissionDenied: setResult.permissionDenied,
            error: setResult.permissionDenied
              ? "Router menolak akses untuk mengubah profil PPP. Periksa hak write user API di Mikrotik."
              : setResult.error ?? "Gagal mengembalikan profil di Mikrotik",
          };
        }

        if (!(await verifyPppProfileSet(api, ppp.name, matchedRestore))) {
          const still = await readPppSecretProfile(api, ppp.name);
          return {
            ok: false,
            error: `Profil PPP di Mikrotik masih "${still?.profile ?? "?"}" — gagal mengembalikan ke "${matchedRestore}".`,
          };
        }

        const removeResult = await removePppActiveSession(api, ppp.name);
        const permissionDenied = removeResult.permissionDenied;

        await prisma.$transaction(async (tx) => {
          await tx.pppSecret.update({
            where: { routerId_name: { routerId: router.id, name: ppp.name } },
            data: {
              profile: matchedRestore,
              profileBeforeIsolir: null,
              isIsolir: false,
              disabled: "false",
            },
          });
          await tx.pppActive.deleteMany({
            where: { routerId: router.id, name: ppp.name },
          });
        });

        await tagihanAfterBukaIsolir(router.id, ppp.name);

        return {
          ok: true,
          permissionDenied,
          oldProfile: ppp.profile,
          newProfile: matchedRestore,
        };
      }
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function restoreLegacyDisabledIsolir(
  router: RouterCredentials,
  ppp: PppIsolirSecret
): Promise<IsolirOperationResult> {
  const isolirProfile = router.isolirProfileName?.trim();
  const restoreProfile = await resolveProfileBeforeIsolir({
    routerId: router.id,
    ppp,
    isolirProfileName: isolirProfile,
  });

  try {
    return await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `restore-legacy:${router.id}:${ppp.name}`,
      async (api) => {
        const pppData = await api.write(["/ppp/secret/print", `?name=${ppp.name}`]);
        const id = (pppData.at(0) as Record<string, string> | undefined)?.[".id"];
        if (!id) {
          return { ok: false, error: "PPP tidak ditemukan di router" };
        }

        if (restoreProfile) {
          const routerProfiles = await fetchRouterPppProfileNames(api);
          const matchedRestore = matchProfileOnRouter(
            [restoreProfile],
            routerProfiles
          );
          if (!matchedRestore) {
            return {
              ok: false,
              error: `Profil "${restoreProfile}" tidak ada di Mikrotik. Nama profil PPP di router harus sama dengan profil/paket pelanggan.`,
            };
          }

          const setResult = await setPppProfileOnMikrotik(
            api,
            ppp.name,
            matchedRestore
          );
          if (!setResult.ok) {
            return {
              ok: false,
              permissionDenied: setResult.permissionDenied,
              error: setResult.permissionDenied
                ? "Router menolak akses untuk mengubah profil PPP. Periksa hak write user API di Mikrotik."
                : setResult.error ?? "Gagal mengembalikan profil di Mikrotik",
            };
          }

          if (!(await verifyPppProfileSet(api, ppp.name, matchedRestore))) {
            const still = await readPppSecretProfile(api, ppp.name);
            return {
              ok: false,
              error: `Profil PPP di Mikrotik masih "${still?.profile ?? "?"}" — gagal mengembalikan ke "${matchedRestore}".`,
            };
          }

          await removePppActiveSession(api, ppp.name);

          await prisma.pppSecret.update({
            where: { routerId_name: { routerId: router.id, name: ppp.name } },
            data: {
              disabled: "false",
              isIsolir: false,
              profile: matchedRestore,
              profileBeforeIsolir: null,
            },
          });

          await tagihanAfterBukaIsolir(router.id, ppp.name);

          return {
            ok: true,
            oldProfile: ppp.profile,
            newProfile: matchedRestore,
          };
        }

        try {
          await api.write(["/ppp/secret/set", `=.id=${id}`, "=disabled=no"]);
        } catch (err) {
          if (isPermissionError(err)) {
            return {
              ok: false,
              permissionDenied: true,
              error:
                "Router menolak akses untuk mengubah profil PPP. Periksa hak write user API di Mikrotik.",
            };
          }
          throw err;
        }

        await removePppActiveSession(api, ppp.name);

        await prisma.pppSecret.update({
          where: { routerId_name: { routerId: router.id, name: ppp.name } },
          data: {
            disabled: "false",
            isIsolir: false,
          },
        });

        await tagihanAfterBukaIsolir(router.id, ppp.name);

        return {
          ok: true,
          oldProfile: ppp.profile,
          newProfile: ppp.profile,
        };
      }
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Toggle isolir manual (dipakai route API lama). */
export async function togglePppIsolir(params: {
  router: RouterCredentials;
  ppp: PppIsolirSecret;
}): Promise<IsolirOperationResult> {
  const isolirProfile = params.router.isolirProfileName?.trim();
  const currentlyIsolir = isPppIsolir(params.ppp, {
    isolirProfileName: isolirProfile,
  });

  if (currentlyIsolir) {
    return restoreCustomer(params);
  }
  return isolateCustomer(params);
}

export async function loadRouterCredentials(
  routerId: number
): Promise<RouterCredentials | null> {
  return prisma.router.findFirst({
    where: { id: routerId, deleted: false },
    select: {
      id: true,
      host: true,
      port: true,
      user: true,
      password: true,
      isolirProfileName: true,
    },
  });
}

export async function writeAutoIsolirLog(
  tx: Prisma.TransactionClient,
  data: Prisma.AutoIsolirLogCreateInput
) {
  return tx.autoIsolirLog.create({ data });
}
