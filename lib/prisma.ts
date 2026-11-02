import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prismaGlobal?: PrismaClient;
};

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prismaGlobal;
  // Singleton dev bisa stale setelah `prisma generate` — buang jika model baru belum ada
  if (cached) {
    if (
      "regulatorySettings" in cached &&
      "pppPackageChange" in cached &&
      "pppBooster" in cached &&
      "paketRouter" in cached
    ) {
      return cached;
    }
    void (cached as PrismaClient).$disconnect().catch(() => undefined);
  }
  const client = new PrismaClient();
  // Selalu cache di globalThis agar HMR/dev reload tidak membuat banyak PrismaClient
  // (masing-masing mendaftarkan beforeExit di process).
  globalForPrisma.prismaGlobal = client;
  return client;
}

const prisma = getPrismaClient();

export default prisma;
