import ActivityLogPage from "@/components/log/activity-log";
import { guardHomePage } from "@/lib/home-page-guard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Log Aktivitas",
};

export default async function LogPage() {
  await guardHomePage("/log");

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <ActivityLogPage />
    </div>
  );
}
