import PembukuanDashboard from "@/components/pembukuan/dashboard";
import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { requirePageAccess } from "@/lib/route-access";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Router Monitoring | Pembukuan",
  description: "Halaman pembukuan keuangan",
};

export default async function PembukuanPage() {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");

  requirePageAccess(user, "/pembukuan");

  // Superadmin: agregat global. Admin & staff mitra: data mitra induk.
  const dashboardUserId =
    user.role === "Superadmin" ? undefined : getOwnedResourcesUserId(user);

  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      <PembukuanDashboard userId={dashboardUserId} />
    </div>
  );
}
