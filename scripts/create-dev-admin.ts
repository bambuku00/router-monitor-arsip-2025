#!/usr/bin/env npx ts-node
/**
 * DEVELOPMENT ONLY — bootstrap Superadmin lokal (idempotent).
 *
 * Membuat atau memperbarui akun Superadmin default untuk database lokal kosong.
 * Ditolak otomatis saat NODE_ENV=production kecuali ALLOW_DEV_ADMIN_BOOTSTRAP=1.
 *
 * Override opsional ( .env ):
 *   DEV_ADMIN_USERNAME=admin
 *   DEV_ADMIN_PASSWORD=admin123
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import { hashUserPassword } from "../lib/password-hash";

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin123";
const DEFAULT_NAMA = "Superadmin Lokal";

function assertDevelopmentOnly(): void {
  if (process.env.ALLOW_DEV_ADMIN_BOOTSTRAP === "1") {
    return;
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      "create:admin ditolak: NODE_ENV=production. Script ini hanya untuk development lokal."
    );
    console.error(
      "Jangan gunakan di production. Override darurat: ALLOW_DEV_ADMIN_BOOTSTRAP=1 (tidak disarankan)."
    );
    process.exit(1);
  }
}

function resolveCredentials(): { username: string; password: string } {
  const username =
    process.env.DEV_ADMIN_USERNAME?.trim() || DEFAULT_USERNAME;
  const password =
    process.env.DEV_ADMIN_PASSWORD?.trim() || DEFAULT_PASSWORD;

  if (
    username.length < 3 ||
    username.length > 31 ||
    !/^[a-z0-9_-]+$/.test(username)
  ) {
    throw new Error(
      `Username tidak valid: "${username}" (3–31 karakter, huruf kecil/angka/_/-)`
    );
  }
  if (password.length < 8 || password.length > 255) {
    throw new Error("Password tidak valid (minimal 8 karakter, maks 255)");
  }

  return { username, password };
}

async function main(): Promise<void> {
  assertDevelopmentOnly();

  const { username, password } = resolveCredentials();
  const existing = await prisma.user.findUnique({ where: { user: username } });
  const passwordHash = await hashUserPassword(password);

  const userData = {
    nama: DEFAULT_NAMA,
    password: passwordHash,
    role: "Superadmin" as const,
    disabled: false,
    verified: true,
  };

  const result = await prisma.user.upsert({
    where: { user: username },
    create: {
      user: username,
      ...userData,
    },
    update: userData,
  });

  const action = existing ? "diperbarui" : "dibuat";
  console.log(
    JSON.stringify(
      {
        ok: true,
        action,
        id: result.id,
        user: result.user,
        role: result.role,
        disabled: result.disabled,
        verified: result.verified,
        hint: "Login di /login dengan kredensial dev (lihat README script / .env.example).",
      },
      null,
      2
    )
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
