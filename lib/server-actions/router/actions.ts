"use server";
import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { logger } from "@/lib/logger";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";

export async function checkRouter(id: number) {
  try {
    const { user } = await validateRequest();
    if (!user) return false;

    const router = await getRouterForUser(id, user);
    if (!router) return false;

    await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `checkRouter:${id}`,
      async () => undefined
    );
    return true;
  } catch (err) {
    logger.error({ msg: "checkRouter error", error: (err as Error).message });
    return false;
  }
}
