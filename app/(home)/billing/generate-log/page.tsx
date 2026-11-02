import BillingGenerateLogPage from "@/components/billing/generate-log";
import { guardHomePage } from "@/lib/home-page-guard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Log Generate Tagihan",
};

export default async function Page() {
  await guardHomePage("/billing/generate-log");

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <BillingGenerateLogPage />
    </div>
  );
}
