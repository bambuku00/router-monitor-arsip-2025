import { PrismaClient } from "@prisma/client";
import { UserPutSchema } from "../lib/user-put-schema";

async function main() {
  const prisma = new PrismaClient();
  const admins = await prisma.user.findMany({
    where: { role: "Admin" },
    select: { id: true, nama: true, revenueBasis: true },
  });
  console.log("DB Admin revenueBasis:", JSON.stringify(admins, null, 2));

  const sample = {
    id: 2,
    nama: "Test Mitra",
    user: "mitra1",
    password: "",
    role: "Admin",
    omset: 50,
    ppn: 11,
    revenueBasis: "PAID",
    billingStartMode: "NEXT_MONTH",
  };
  const parsed = UserPutSchema.safeParse(sample);
  console.log(
    "Parse PAID payload:",
    parsed.success,
    parsed.success ? parsed.data.revenueBasis : parsed.error.flatten()
  );

  await prisma.$disconnect();
}

main().catch(console.error);
