import type { User } from "@prisma/client";

/** Jangan kirim hash password user ke client. */
export function sanitizeUserForClient<T extends Pick<User, "password">>(
  user: T
): Omit<T, "password"> {
  const { password: _password, ...safe } = user;
  return safe;
}

/** Jangan kirim kredensial RouterOS ke client (tetap disimpan di DB untuk koneksi). */
export function sanitizeRouterForClient<T extends { password?: string }>(
  router: T
): Omit<T, "password"> {
  const { password: _password, ...safe } = router;
  return safe;
}

export function sanitizeRoutersForClient<T extends { password?: string }>(
  routers: T[]
): Omit<T, "password">[] {
  return routers.map(sanitizeRouterForClient);
}
