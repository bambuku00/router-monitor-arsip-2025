import { formatIsolirActor, jakartaMonthRange } from "@/lib/isolir-actor-label";
import prisma from "@/lib/prisma";

export async function recordManualIsolirLog(params: {
  actor: { id: number; nama?: string | null; user?: string | null };
  routerUserId: number | null;
  pppSecretId: number;
  pppUsername: string;
  routerId: number;
  action: "isolate" | "restore";
  oldProfile?: string | null;
  newProfile?: string | null;
}) {
  const pelanggan = await prisma.pelanggan.findFirst({
    where: { ppp_secretId: params.pppSecretId },
    select: { id: true },
  });

  await prisma.autoIsolirLog.create({
    data: {
      userId: params.routerUserId ?? params.actor.id,
      pelangganId: pelanggan?.id ?? null,
      pppUsername: params.pppUsername,
      routerId: params.routerId,
      action: params.action,
      status: "success",
      executedBy: formatIsolirActor(params.actor),
      oldProfile: params.oldProfile ?? null,
      newProfile: params.newProfile ?? null,
      dryRun: false,
      batchId: "manual",
    },
  });
}

async function withReadableActors<T extends { executedBy: string }>(
  logs: T[]
): Promise<T[]> {
  const userIds = new Set<number>();
  for (const log of logs) {
    const match = /^user:(\d+)$/.exec(log.executedBy.trim());
    if (match) userIds.add(Number(match[1]));
  }
  const users =
    userIds.size === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, nama: true, user: true },
        });
  const userMap = new Map(users.map((user) => [user.id, user]));

  return logs.map((log) => {
    const match = /^user:(\d+)$/.exec(log.executedBy.trim());
    if (!match) return log;
    const user = userMap.get(Number(match[1]));
    if (!user) return { ...log, executedBy: `Pengguna #${match[1]}` };
    return { ...log, executedBy: formatIsolirActor(user) };
  });
}

export async function resolveIsolirExecutedBy<T extends { executedBy: string }>(
  logs: T[]
): Promise<T[]> {
  return withReadableActors(logs);
}

function firstActorByPelanggan(
  logs: { pelangganId: number | null; executedBy: string; created: Date }[]
) {
  const map = new Map<number, { executedBy: string; created: Date }>();
  for (const log of logs) {
    if (log.pelangganId == null || map.has(log.pelangganId)) continue;
    map.set(log.pelangganId, {
      executedBy: log.executedBy,
      created: log.created,
    });
  }
  return map;
}

export async function latestIsolirActorByPelanggan(pelangganIds: number[]) {
  if (pelangganIds.length === 0) {
    return new Map<number, { executedBy: string; created: Date }>();
  }

  const logs = await prisma.autoIsolirLog.findMany({
    where: {
      pelangganId: { in: pelangganIds },
      action: "isolate",
      status: "success",
      dryRun: false,
    },
    orderBy: { created: "desc" },
    select: { pelangganId: true, executedBy: true, created: true },
  });

  return firstActorByPelanggan(await withReadableActors(logs));
}

/** Buka isolir yang terjadi pada bulan tagihan yang sedang dibuka. */
export async function latestBukaIsolirByPelanggan(
  pelangganIds: number[],
  bulan: string | null | undefined
) {
  const range = bulan ? jakartaMonthRange(bulan) : null;
  if (pelangganIds.length === 0 || !range) {
    return new Map<number, { executedBy: string; created: Date }>();
  }

  const logs = await prisma.autoIsolirLog.findMany({
    where: {
      pelangganId: { in: pelangganIds },
      action: "restore",
      status: "success",
      dryRun: false,
      created: { gte: range.start, lt: range.end },
    },
    orderBy: { created: "desc" },
    select: { pelangganId: true, executedBy: true, created: true },
  });

  return firstActorByPelanggan(await withReadableActors(logs));
}

export async function isolirRiwayatByPelanggan(pelangganId: number) {
  const logs = await prisma.autoIsolirLog.findMany({
    where: {
      pelangganId,
      action: { in: ["isolate", "restore"] },
      status: "success",
      dryRun: false,
    },
    orderBy: { created: "desc" },
    take: 200,
    select: { action: true, executedBy: true, created: true },
  });
  const readable = await withReadableActors(logs);
  return readable.map((log) => ({
    action: log.action,
    executedBy: log.executedBy,
    created: log.created.toISOString(),
  }));
}
