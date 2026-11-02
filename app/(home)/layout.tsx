import AppShell from "@/components/app-shell";
import { NavLayoutProvider } from "@/components/nav-layout-provider";
import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { canAccessPathname } from "@/lib/route-access";
import { countPortalTiketBaruForStaff } from "@/lib/portal-tiket";
import { hasStaffMenuAccess } from "@/lib/staff-menu-access";
import { cn } from "@/lib/utils";
import prisma from "@/lib/prisma";
import { Router } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionData = await validateRequest();
  const { user, session } = sessionData;
  const pathname =
    session && user ? ((await headers()).get("x-pathname") ?? "") : "";
  const isCetakPage =
    pathname.startsWith("/pembayaran/cetak") ||
    pathname.startsWith("/pembayaran/kuitansi") ||
    pathname.startsWith("/petugas/cetak");

  if (session && user && pathname && !pathname.startsWith("/forbidden")) {
    if (!canAccessPathname(user, pathname)) {
      redirect("/forbidden");
    }
  }

  /** Hanya field yang dipakai AppShell (nav/header) — password RouterOS TIDAK pernah di-select. */
  type NavRouter = Pick<Router, "id" | "nama" | "host" | "port">;
  const navRouterSelect = { id: true, nama: true, host: true, port: true } as const;
  let routers: NavRouter[] = [];
  let tiketBaru = 0;

  const canLoadRoutersForNav =
    session &&
    user &&
    (canAccessPathname(user, "/routers") ||
      hasStaffMenuAccess(user, "pppoe"));

  if (canLoadRoutersForNav) {
    if (user.role === "Superadmin") {
      routers = await prisma.router.findMany({
        orderBy: {
          created: "desc",
        },
        select: navRouterSelect,
      });
    } else {
      const scopeUserId = getOwnedResourcesUserId(user);
      routers = await prisma.router.findMany({
        where: { userId: scopeUserId },
        orderBy: {
          created: "desc",
        },
        select: navRouterSelect,
      });
    }
  }

  if (session && user && hasStaffMenuAccess(user, "pppoe")) {
    tiketBaru = await countPortalTiketBaruForStaff(user);
  }

  if (isCetakPage) {
    return (
      <main
        className={cn(
          "flex relative flex-col text-slate-700 dark:text-theme-fg items-stretch bg-white dark:bg-theme-bg",
          "min-h-0 pt-0 px-0 pb-0"
        )}
      >
        {children}
      </main>
    );
  }

  return (
    <NavLayoutProvider>
      <AppShell routers={routers} session={sessionData} tiketBaru={tiketBaru}>
        {children}
      </AppShell>
    </NavLayoutProvider>
  );
}
