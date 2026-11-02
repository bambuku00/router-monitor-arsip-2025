import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    CRON_SECRET: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    LOG_LEVEL: z.string().optional(),
    WOOWA_DEVICE_ID: z.string().optional(),
    ROUTER_PASSWORD_ENCRYPTION_KEY: z.string().optional(),
    REGISTER_CHALLENGE_SECRET: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
  });

/** Fail-closed di production: secret wajib valid sebelum app menerima traffic sensitif. */
function assertProductionSecrets(val: z.infer<typeof envSchema>): void {
  const isBuild =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION === "1";
  if (val.NODE_ENV !== "production" || isBuild) return;

  const secret = val.CRON_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new Error(
      "[env] CRON_SECRET wajib di production (minimal 32 karakter). Generate: openssl rand -hex 32"
    );
  }
  const encKey = val.ROUTER_PASSWORD_ENCRYPTION_KEY?.trim() ?? "";
  if (encKey.length < 32) {
    throw new Error(
      "[env] ROUTER_PASSWORD_ENCRYPTION_KEY wajib di production (openssl rand -hex 32)."
    );
  }
}

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    WOOWA_DEVICE_ID: process.env.WOOWA_DEVICE_ID,
    ROUTER_PASSWORD_ENCRYPTION_KEY:
      process.env.ROUTER_PASSWORD_ENCRYPTION_KEY,
    REGISTER_CHALLENGE_SECRET: process.env.REGISTER_CHALLENGE_SECRET,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  });

  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }

  assertProductionSecrets(parsed.data);
  return parsed.data;
}

/** Route cron memakai ini — secret harus ≥32 karakter di production. */
export function isCronSecretConfigured(): boolean {
  return (env.CRON_SECRET?.trim() ?? "").length >= 32;
}

export const env = parseEnv();

/** Use this in routes that require CRON_SECRET (e.g. generate payments). */
export function getCronSecret(): string {
  const secret = env.CRON_SECRET;
  if (!secret) {
    throw new Error("CRON_SECRET is not set. Add it to .env for cron endpoints.");
  }
  return secret;
}
