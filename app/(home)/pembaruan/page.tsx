import PembaruanPageContent from "@/components/pembaruan/updates-page";
import { guardHomePage } from "@/lib/home-page-guard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Pembaruan Website",
  description: "Info fitur baru, menu, dan perbaikan sistem",
};

export default async function PembaruanPage() {
  await guardHomePage("/pembaruan");

  return (
    <div className="flex flex-col items-stretch gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      <PembaruanPageContent />
    </div>
  );
}
