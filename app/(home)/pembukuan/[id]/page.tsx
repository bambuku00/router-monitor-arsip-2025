import PembukuanDashboard from "@/components/pembukuan/dashboard";
import { validateRequest } from "@/lib/auth";
import { isMitraStaff } from "@/lib/pembukuan-scope";
import { canAccessUser, getOwnedResourcesUserId } from "@/lib/rbac";
import { redirectToAllowedOrForbidden, requirePageAccess } from "@/lib/route-access";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Router Monitoring | Pembukuan Mitra",
  description: "Halaman pembukuan mitra",
};

export default async function PembukuanMitraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");

  requirePageAccess(user, "/pembukuan");

  const { id } = await params;
  const mitraId = parseInt(id);
  if (isNaN(mitraId)) {
    return <div>Invalid Mitra ID</div>;
  }

  if (
    user.role !== "Superadmin" &&
    !canAccessUser(user, mitraId)
  ) {
    redirectToAllowedOrForbidden(user);
  }

  if (isMitraStaff(user) && mitraId !== getOwnedResourcesUserId(user)) {
    return redirect("/pembukuan");
  }

  const mitra = await prisma.user.findUnique({
    where: { id: mitraId },
    select: { nama: true },
  });

  if (!mitra) {
    return <div>Mitra not found</div>;
  }

  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      <PembukuanDashboard userId={mitraId} title="Pembukuan" />
    </div>
  );
}
