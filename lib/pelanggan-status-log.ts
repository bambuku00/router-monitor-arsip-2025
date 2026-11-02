import { formatIsolirActor } from "@/lib/isolir-actor-label";
import prisma from "@/lib/prisma";
import { PelangganStatusAction, Prisma } from "@prisma/client";

type StatusActor = { nama?: string | null; user?: string | null };

export async function recordPelangganStatusLog(
  params: {
    pelangganId: number;
    action: PelangganStatusAction;
    actor: StatusActor | "system";
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const executedBy =
    params.actor === "system" ? "system" : formatIsolirActor(params.actor);
  await db.pelangganStatusLog.create({
    data: {
      pelangganId: params.pelangganId,
      action: params.action,
      executedBy,
    },
  });
}

async function withReadableActors<T extends { executedBy: string }>(logs: T[]) {
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
    if (!user) return log;
    return { ...log, executedBy: formatIsolirActor(user) };
  });
}

async function latestStatusActionByPelanggan(
  pelangganIds: number[],
  action: PelangganStatusAction
) {
  const map = new Map<number, { executedBy: string; created: Date }>();
  if (pelangganIds.length === 0) return map;
  const logs = await prisma.pelangganStatusLog.findMany({
    where: { pelangganId: { in: pelangganIds }, action },
    orderBy: { created: "desc" },
    select: { pelangganId: true, executedBy: true, created: true },
  });
  for (const log of await withReadableActors(logs)) {
    if (map.has(log.pelangganId)) continue;
    map.set(log.pelangganId, {
      executedBy: log.executedBy,
      created: log.created,
    });
  }
  return map;
}

export function latestBerhentiByPelanggan(pelangganIds: number[]) {
  return latestStatusActionByPelanggan(pelangganIds, "stop");
}

export function latestLanjutByPelanggan(pelangganIds: number[]) {
  return latestStatusActionByPelanggan(pelangganIds, "resume");
}

export async function berhentiRiwayatByPelanggan(pelangganId: number) {
  const logs = await prisma.pelangganStatusLog.findMany({
    where: { pelangganId },
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
