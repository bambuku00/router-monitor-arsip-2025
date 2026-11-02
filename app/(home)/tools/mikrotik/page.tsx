import MikrotikManager from "@/components/tools/mikrotik-manager";
import { guardHomePage } from "@/lib/home-page-guard";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { Router } from "@prisma/client";

/** Hanya field yang dipakai MikrotikManager/MikrotikListView. Password RouterOS TIDAK di-select. */
type ToolsRouter = Pick<Router, "id" | "nama" | "host">;
const toolsRouterSelect = { id: true, nama: true, host: true } as const;

export default async function Page() {
  const { user } = await guardHomePage("/tools/mikrotik");

  let routers: ToolsRouter[] = [];
  if (user.role === "Superadmin") {
    routers = await prisma.router.findMany({
      orderBy: { created: "desc" },
      select: toolsRouterSelect,
    });
  } else {
    routers = await prisma.router.findMany({
      where: { userId: getOwnedResourcesUserId(user) },
      orderBy: { created: "desc" },
      select: toolsRouterSelect,
    });
  }

  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <MikrotikManager routers={routers} />
    </div>
  );
}
