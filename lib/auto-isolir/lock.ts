import prisma from "@/lib/prisma";
import { randomUUID } from "node:crypto";

const LOCK_NAME = "auto-isolir";
const LOCK_TTL_MS = 30 * 60 * 1000;

export async function acquireJobLock(owner: string): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_TTL_MS);

  const existing = await prisma.jobLock.findUnique({
    where: { name: LOCK_NAME },
  });

  if (existing && existing.lockedUntil > now) {
    return false;
  }

  await prisma.jobLock.upsert({
    where: { name: LOCK_NAME },
    create: {
      name: LOCK_NAME,
      lockedAt: now,
      lockedUntil,
      owner,
    },
    update: {
      lockedAt: now,
      lockedUntil,
      owner,
    },
  });

  return true;
}

export async function releaseJobLock(owner: string): Promise<void> {
  const existing = await prisma.jobLock.findUnique({
    where: { name: LOCK_NAME },
  });
  if (existing?.owner === owner) {
    await prisma.jobLock.delete({ where: { name: LOCK_NAME } }).catch(() => {});
  }
}

export function newBatchId(): string {
  return randomUUID();
}
