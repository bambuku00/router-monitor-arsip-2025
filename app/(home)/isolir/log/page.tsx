import AutoIsolirLogPage from "@/components/isolir/auto-isolir-log";
import { guardHomePage } from "@/lib/home-page-guard";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Log Auto Isolir",
};

export default async function IsolirLogPage() {
  const { user } = await guardHomePage("/isolir/log");

  const mitraUserId = getOwnedResourcesUserId({
    id: user.id,
    role: user.role,
    parentId: user.parentId ?? undefined,
  });

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <AutoIsolirLogPage userId={mitraUserId} />
    </div>
  );
}
