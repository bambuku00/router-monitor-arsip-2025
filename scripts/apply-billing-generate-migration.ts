import { PrismaClient } from "@prisma/client";

async function columnExists(
  prisma: PrismaClient,
  table: string,
  column: string
): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<
    { Field: string }[]
  >(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
  return rows.length > 0;
}

async function tableExists(
  prisma: PrismaClient,
  table: string
): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ Tables_in_db: string }[]>(
    `SHOW TABLES LIKE '${table}'`
  );
  return rows.length > 0;
}

async function main() {
  const prisma = new PrismaClient();

  if (!(await tableExists(prisma, "settings"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE \`settings\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`billing_generate_day\` INTEGER NOT NULL DEFAULT 25,
        \`billing_generate_hour\` INTEGER NOT NULL DEFAULT 1,
        \`updated\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`settings\` (\`id\`, \`billing_generate_day\`, \`billing_generate_hour\`, \`updated\`)
      VALUES (1, 25, 1, CURRENT_TIMESTAMP(3))
    `);
    console.log("Created table settings");
  } else {
    console.log("Table settings already exists");
  }

  if (!(await columnExists(prisma, "User", "billing_generate_day"))) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`User\` ADD COLUMN \`billing_generate_day\` INTEGER NULL
    `);
    console.log("Added User.billing_generate_day");
  } else {
    console.log("Column User.billing_generate_day already exists");
  }

  if (!(await tableExists(prisma, "billing_generate_logs"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE \`billing_generate_logs\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`client_id\` INTEGER NOT NULL,
        \`period\` VARCHAR(191) NOT NULL,
        \`status\` ENUM('success', 'failed', 'skipped') NOT NULL,
        \`invoiceCount\` INTEGER NOT NULL DEFAULT 0,
        \`message\` TEXT NULL,
        \`generated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX \`billing_generate_logs_period_idx\`(\`period\`),
        INDEX \`billing_generate_logs_generated_at_idx\`(\`generated_at\`),
        UNIQUE INDEX \`billing_generate_logs_client_id_period_key\`(\`client_id\`, \`period\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`billing_generate_logs_client_id_fkey\` FOREIGN KEY (\`client_id\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log("Created table billing_generate_logs");
  } else {
    console.log("Table billing_generate_logs already exists");
  }

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
