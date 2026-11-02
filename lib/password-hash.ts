import { hash } from "argon2";

/**
 * Opsi Argon2 untuk password user — harus identik dengan
 * `ARGON2_OPTS` di `lib/server-actions/auth-actions.ts`.
 */
export const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashUserPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, ARGON2_OPTS);
}
