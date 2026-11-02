import { isImportablePppProfile } from "@/lib/mikrotik-paket";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  routerToCredentialsWithHostPolicy,
  withRouterOsClient,
} from "@/lib/routeros-session";

export type PppBackupProfile = {
  name: string;
  rateLimit: string | null;
  localAddress: string | null;
  remoteAddress: string | null;
  onlyOne: string | null;
  comment: string | null;
  dnsServer: string | null;
  addressList: string | null;
  parentQueue: string | null;
  queueType: string | null;
  bridge: string | null;
  sessionTimeout: string | null;
  idleTimeout: string | null;
  changeTcpMss: string | null;
};

export type PppBackupPool = {
  name: string;
  ranges: string;
  nextPool: string | null;
  comment: string | null;
};

export type PppProfileBackupSnapshot = {
  savedAt: string;
  profiles: PppBackupProfile[];
  pools: PppBackupPool[];
};

const PRINT_FIELDS = [
  ["rate-limit", "rateLimit"],
  ["local-address", "localAddress"],
  ["remote-address", "remoteAddress"],
  ["only-one", "onlyOne"],
  ["comment", "comment"],
  ["dns-server", "dnsServer"],
  ["address-list", "addressList"],
  ["parent-queue", "parentQueue"],
  ["queue-type", "queueType"],
  ["bridge", "bridge"],
  ["session-timeout", "sessionTimeout"],
  ["idle-timeout", "idleTimeout"],
  ["change-tcp-mss", "changeTcpMss"],
] as const;

function textField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function profilesFromRouterPrint(rows: unknown): PppBackupProfile[] {
  if (!Array.isArray(rows)) return [];
  const profiles: PppBackupProfile[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const name = textField(record, "name");
    if (!name || !isImportablePppProfile(name)) continue;
    const profile = { name } as PppBackupProfile;
    for (const [source, target] of PRINT_FIELDS) {
      profile[target] = textField(record, source);
    }
    profiles.push(profile);
  }
  return profiles;
}

export function poolsFromRouterPrint(rows: unknown): PppBackupPool[] {
  if (!Array.isArray(rows)) return [];
  const pools: PppBackupPool[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const name = textField(record, "name");
    const ranges = textField(record, "ranges");
    if (!name || !ranges) continue;
    pools.push({
      name,
      ranges,
      nextPool: textField(record, "next-pool") ?? textField(record, "nextPool"),
      comment: textField(record, "comment"),
    });
  }
  return pools;
}

function orderPools(pools: PppBackupPool[]): PppBackupPool[] {
  const byName = new Map(pools.map((pool) => [pool.name, pool]));
  const ordered: PppBackupPool[] = [];
  const seen = new Set<string>();
  const visit = (pool: PppBackupPool) => {
    if (seen.has(pool.name)) return;
    seen.add(pool.name);
    const next = pool.nextPool ? byName.get(pool.nextPool) : undefined;
    if (next) visit(next);
    ordered.push(pool);
  };
  for (const pool of [...pools].sort((a, b) => a.name.localeCompare(b.name, "id"))) {
    visit(pool);
  }
  return ordered;
}

export { orderPools };

export function parsePppProfileBackup(value: unknown): PppProfileBackupSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.profiles)) return null;
  const profiles = profilesFromRouterPrint(
    record.profiles.map((profile) => {
      if (!profile || typeof profile !== "object") return null;
      const row = profile as Partial<PppBackupProfile>;
      return {
        name: row.name,
        "rate-limit": row.rateLimit,
        "local-address": row.localAddress,
        "remote-address": row.remoteAddress,
        "only-one": row.onlyOne,
        comment: row.comment,
        "dns-server": row.dnsServer,
        "address-list": row.addressList,
        "parent-queue": row.parentQueue,
        "queue-type": row.queueType,
        bridge: row.bridge,
        "session-timeout": row.sessionTimeout,
        "idle-timeout": row.idleTimeout,
        "change-tcp-mss": row.changeTcpMss,
      };
    })
  );
  const savedAt = typeof record.savedAt === "string" ? record.savedAt : "";
  const pools = Array.isArray(record.pools)
    ? poolsFromRouterPrint(
        record.pools.map((pool) => {
          if (!pool || typeof pool !== "object") return null;
          const row = pool as Partial<PppBackupPool>;
          return {
            name: row.name,
            ranges: row.ranges,
            "next-pool": row.nextPool,
            comment: row.comment,
          };
        })
      )
    : [];
  return { savedAt, profiles, pools };
}

export async function rememberPppBackup(
  routerId: number,
  parts: {
    profiles: PppBackupProfile[] | null;
    pools: PppBackupPool[] | null;
  }
): Promise<PppProfileBackupSnapshot | null> {
  if (!parts.profiles && !parts.pools) return null;
  try {
    const current = await prisma.router.findUnique({
      where: { id: routerId },
      select: { pppProfileBackup: true },
    });
    const previous = parsePppProfileBackup(current?.pppProfileBackup);
    const snapshot: PppProfileBackupSnapshot = {
      savedAt: new Date().toISOString(),
      profiles: parts.profiles ?? previous?.profiles ?? [],
      pools: parts.pools ?? previous?.pools ?? [],
    };
    await prisma.router.update({
      where: { id: routerId },
      data: { pppProfileBackup: snapshot },
    });
    return snapshot;
  } catch (err) {
    logger.warn({
      msg: "Gagal menyimpan cadangan profil PPPoE",
      routerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function refreshPppProfileBackup(router: {
  id: number;
  host: string;
  port: number | null;
  user: string;
  password: string;
}): Promise<PppProfileBackupSnapshot | null> {
  try {
    const parts = await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `ppp-profile-backup:${router.id}`,
      async (api) => {
        let profiles: PppBackupProfile[] | null = null;
        let pools: PppBackupPool[] | null = null;
        try {
          profiles = profilesFromRouterPrint(await api.write("/ppp/profile/print"));
        } catch (err) {
          logger.warn({
            msg: "Gagal membaca profil PPPoE untuk cadangan",
            routerId: router.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        try {
          pools = poolsFromRouterPrint(await api.write("/ip/pool/print"));
        } catch (err) {
          logger.warn({
            msg: "Gagal membaca IP pool untuk cadangan",
            routerId: router.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return { profiles, pools };
      }
    );
    return rememberPppBackup(router.id, parts);
  } catch (err) {
    logger.warn({
      msg: "Gagal membaca profil PPPoE untuk cadangan",
      routerId: router.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
