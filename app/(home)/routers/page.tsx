import Data from "@/components/routers/data";
import { validateRequest } from "@/lib/auth";
import { countPppTanpaPelangganByRouterId } from "@/lib/routers-ppp-belum-input";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { requirePageAccess } from "@/lib/route-access";
import { routerListPrismaSelect } from "@/lib/router-manage-access";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Router Monitoring | Routers List",
  description: "List router user",
};
export default async function Routers() {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    redirect("/login");
  }

  requirePageAccess(user, "/routers");

  const routerListSelect = routerListPrismaSelect(user.role);

  let routers;

  if (user.role === "Superadmin") {
    const routersRaw = await prisma.router.findMany({
      where: { deleted: false },
      select: {
        ...routerListSelect,
        users: { select: { nama: true } },
        _count: {
          select: {
            pelanggan: true,
            ppp_secret: true,
          },
        },
      },
    });
    const tanpaPelanggan = await countPppTanpaPelangganByRouterId();
    routers = routersRaw.map((r) => ({
      ...r,
      pppBelumInput: tanpaPelanggan.get(r.id) ?? 0,
    }));
  } else {
    const scopeUserId = getOwnedResourcesUserId(user);
    routers = await prisma.router.findMany({
      where: { userId: scopeUserId, deleted: false },
      select: routerListSelect,
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      <Data routers={routers} user={user} />
    </div>
  );
}
