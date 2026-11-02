import PortalSettingsForm from "@/components/settings/portal-settings";
import { guardHomePage } from "@/lib/home-page-guard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Portal Pelanggan",
};

export default async function PortalSettingsPage() {
  const { user } = await guardHomePage("/settings/portal");

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <PortalSettingsForm isSuperadmin={user.role === "Superadmin"} />
    </div>
  );
}
