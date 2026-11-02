import AutoIsolirSettingsPage from "@/components/isolir/auto-isolir-settings";
import { guardHomePage } from "@/lib/home-page-guard";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Isolir Otomatis",
};

export default async function IsolirSettingsPage() {
  const { user } = await guardHomePage("/isolir/settings");

  const mitraUserId = getOwnedResourcesUserId({
    id: user.id,
    role: user.role,
    parentId: user.parentId ?? undefined,
  });

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <AutoIsolirSettingsPage userId={mitraUserId} />
    </div>
  );
}
