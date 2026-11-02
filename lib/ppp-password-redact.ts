/**
 * Strip PPP / RouterOS / Prisma `password` fields from API payloads.
 * Recursive — covers nested arrays (print results) and transaction objects.
 */
export function redactPasswordFields<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactPasswordFields(item)) as T;
  }
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "password") continue;
    out[key] = redactPasswordFields(child);
  }
  return out as T;
}

/** True when the actor may receive PPP passwords (Superadmin maintenance only). */
export function mayExposePppPasswords(role: string | undefined | null): boolean {
  return role === "Superadmin";
}

/**
 * Redact unless Superadmin. Use for RouterOS print / Tools proxy responses.
 */
export function redactPppPasswordsUnlessSuperadmin<T>(
  value: T,
  role: string | undefined | null
): T {
  if (mayExposePppPasswords(role)) return value;
  return redactPasswordFields(value);
}
