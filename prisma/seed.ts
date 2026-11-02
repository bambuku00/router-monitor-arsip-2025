import { hash } from "argon2";
import { logger } from "../lib/logger";
import prisma from "../lib/prisma";

const HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function main() {
  const superPw = process.env.SEED_SUPERADMIN_PASSWORD?.trim();
  if (!superPw) {
    logger.warn({
      msg: "seed: SEED_SUPERADMIN_PASSWORD tidak di-set; lewati pembuatan/rotasi Superadmin",
    });
  } else {
    const superadminHash = await hash(superPw, HASH_OPTIONS);

    await prisma.user.upsert({
      where: { id: 1 },
      create: {
        nama: "Superadmin",
        user: "adminwi",
        role: "Superadmin",
        password: superadminHash,
      },
      update: {
        nama: "Superadmin",
        user: "adminwi",
        role: "Superadmin",
        password: superadminHash,
      },
    });
  }

  const demoPw = process.env.SEED_DEMO_ADMIN_PASSWORD?.trim();
  if (!demoPw) {
    logger.warn({
      msg: "seed: SEED_DEMO_ADMIN_PASSWORD tidak di-set; lewati user demo_admin",
    });
  } else {
    const adminDemoHash = await hash(demoPw, HASH_OPTIONS);
    await prisma.user.upsert({
      where: { user: "demo_admin" },
      create: {
        nama: "Admin Demo",
        user: "demo_admin",
        role: "Admin",
        password: adminDemoHash,
      },
      update: {
        nama: "Admin Demo",
        role: "Admin",
        password: adminDemoHash,
      },
    });
  }
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    logger.error({ msg: "seed error", error: (e as Error).message });
    await prisma.$disconnect();
    process.exit(1);
  });
