import DashboardData from "@/components/dashboard/data";
import { validateRequest } from "@/lib/auth";
import { requirePageAccess } from "@/lib/route-access";
import { getDashboardStats } from "@/lib/server-actions/dashboard/actions";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Router Monitoring | Dashboard",
  description: "Ringkasan operasional router dan pelanggan",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, session } = await validateRequest();
  if (!session || !user) redirect("/login");

  requirePageAccess(user, "/dashboard");

  const stats = await getDashboardStats();
  if ("error" in stats) {
    throw new Error(stats.error);
  }

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      <DashboardData stats={stats.data} user={user} />
    </div>
  );
}
