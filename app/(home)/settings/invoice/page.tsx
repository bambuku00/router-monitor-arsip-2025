import InvoiceSettingsForm from "@/components/settings/invoice-settings-form";
import { guardHomePage } from "@/lib/home-page-guard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Pengaturan Invoice",
};

export default async function InvoiceSettingsPage() {
  await guardHomePage("/settings/invoice");

  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20 px-3 sm:px-4">
      <InvoiceSettingsForm />
    </div>
  );
}
