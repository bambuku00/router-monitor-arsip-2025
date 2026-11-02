"use server";

import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

export async function getRouters() {
  const { user, session } = await validateRequest();
  if (!session)
    return {
      error: "Unauthorized",
    };
  try {
    const routers = await prisma.router.findMany({
      where: {
        userId: user.id,
        deleted: false,
      },
      orderBy: {
        created: "desc",
      },
    });
    return { data: routers };
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "getRouters error", error: error.message });
    return {
      error: "Terjadi kesalahan pada server",
    };
  }
}
