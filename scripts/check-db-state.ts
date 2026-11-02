import prisma from "../lib/prisma";

async function main() {
  const tables = await prisma.$queryRaw<
    { Tables_in_monitoring_winet: string }[]
  >`SHOW TABLES`;
  console.log("TABLES:", tables.map((t) => Object.values(t)[0]).sort());

  const cols = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User'
    ORDER BY COLUMN_NAME
  `;
  console.log("User columns:", cols.map((c) => c.COLUMN_NAME));

  const pppCols = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PppSecret'
    AND COLUMN_NAME IN ('isIsolir', 'profileBeforeIsolir', 'on_router')
  `;
  console.log("PppSecret isolir cols:", pppCols.map((c) => c.COLUMN_NAME));

  const staffScope = await prisma.$queryRaw<{ TABLE_NAME: string }[]>`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_pelanggan_scope'
  `;
  console.log("staff_pelanggan_scope:", staffScope.length > 0 ? "yes" : "no");

  const billingGen = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'billingGenerateDay'
  `;
  console.log("billingGenerateDay:", billingGen.length > 0 ? "yes" : "no");

  try {
    const mig = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date | null }[]
    >`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at`;
    console.log("Migrations:", mig);
  } catch (e) {
    console.log("_prisma_migrations: missing");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
