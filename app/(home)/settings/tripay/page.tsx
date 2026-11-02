import TripaySettingsForm from "@/components/settings/tripay-settings";
import { guardHomePage } from "@/lib/home-page-guard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Tripay",
};

export default async function TripaySettingsPage() {
  const { user } = await guardHomePage("/settings/tripay");

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <TripaySettingsForm isSuperadmin={user.role === "Superadmin"} />
    </div>
  );
}
