import BillingSettingsForm from "@/components/settings/billing-settings";
import { guardHomePage } from "@/lib/home-page-guard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Pengaturan Billing",
};

export default async function BillingSettingsPage() {
  await guardHomePage("/settings/billing");

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <BillingSettingsForm />
    </div>
  );
}
