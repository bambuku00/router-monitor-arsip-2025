import type { Session, User } from "lucia";
import { redirect } from "next/navigation";

import { validateRequest } from "@/lib/auth";
import { requirePageAccess } from "@/lib/route-access";

export type GuardedHomeSession = {
  user: User;
  session: Session;
};

/**
 * Login gate + menu/role page authorization. Call at the top of every private
 * `(home)` page before any database or sensitive data access.
 */
export async function guardHomePage(
  pathname: string
): Promise<GuardedHomeSession> {
  const sessionData = await validateRequest();
  const { user, session } = sessionData;
  if (!session || !user) redirect("/login");
  requirePageAccess(user, pathname);
  return { user, session };
}

/** `/forbidden` — login required, no menu permission needed (prevents redirect loops). */
export async function guardForbiddenPage(): Promise<User | null> {
  const { user, session } = await validateRequest();
  if (!session || !user) redirect("/login");
  return user;
}
