import Data from "@/components/paket/data";
import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { requirePageAccess } from "@/lib/route-access";
import { getPaket } from "@/lib/server-actions/paket/actions";
import prisma from "@/lib/prisma";
import { Router } from "@prisma/client";
import { Metadata } from "next";
import { redirect } from "next/navigation";

/** Hanya field yang dipakai SyncPaketMikrotik (selector router). Password RouterOS TIDAK di-select. */
type PaketPageRouter = Pick<Router, "id" | "nama" | "host">;
const paketPageRouterSelect = { id: true, nama: true, host: true } as const;

export const metadata: Metadata = {
  title: "Router Monitoring | Paket List",
  description: "List paket pelanggan",
};
export const dynamic = "force-dynamic";
export default async function Paket() {
  const { user, session } = await validateRequest();

  if (!session || !user) redirect("/login");

  requirePageAccess(user, "/paket");

  const paket = await getPaket();
  if (paket.error) throw paket.error;

  const routers: PaketPageRouter[] =
    user.role === "Superadmin"
      ? await prisma.router.findMany({
          where: { deleted: false },
          orderBy: { created: "desc" },
          select: paketPageRouterSelect,
        })
      : await prisma.router.findMany({
          where: {
            deleted: false,
            userId: getOwnedResourcesUserId(user),
          },
          orderBy: { created: "desc" },
          select: paketPageRouterSelect,
        });

  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      <Data paket={paket.data} user={user} routers={routers} />
    </div>
  );
}
