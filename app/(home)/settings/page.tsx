import DataBank from "@/components/settings/data-bank";
import { guardHomePage } from "@/lib/home-page-guard";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Pengaturan",
};
export default async function Routers() {
  const { user } = await guardHomePage("/settings");

  let bank;

  if (user.role === "Superadmin") {
    bank = await prisma.bank.findMany({
      include: { user: true },
    });
  } else {
    bank = await prisma.bank.findMany({
      where: { userId: getOwnedResourcesUserId(user) },
    });
  }
  return (
    <div className="flex flex-col gap-4 items-center bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      <DataBank bank={bank} user={user} />
    </div>
  );
}
