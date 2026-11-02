import Data from "@/components/pembayaran/data";
import { validateRequest } from "@/lib/auth";
import { canAccessUser } from "@/lib/rbac";
import { redirectToAllowedOrForbidden, requirePageAccess } from "@/lib/route-access";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Router Monitoring | Pembayaran",
  description: "List pembayaran pelanggan",
};
export default async function Pembayaran(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");
  const params = await props.params;
  requirePageAccess(user, `/pembayaran/${params.id}`);
  const pembayaranUserId = parseInt(params.id);
  if (
    user.role !== "Superadmin" &&
    !canAccessUser(user, pembayaranUserId)
  ) {
    redirectToAllowedOrForbidden(user);
  }

  return (
    <div
      className={
        user.role === "Petugas"
          ? "flex w-full flex-col gap-4 bg-gradient-to-b from-sky-100 via-slate-50 to-emerald-50 px-1 pb-8 text-slate-800 dark:from-theme-bg dark:via-theme-bg dark:to-theme-bg dark:text-theme-fg"
          : "flex w-full min-w-0 max-w-full flex-col items-center gap-4 pb-20 text-slate-700 dark:text-theme-fg max-md:bg-[#e6e9ee] max-md:dark:bg-[#0e0e10] md:bg-white md:dark:bg-theme-bg"
      }
    >
      {/* <Statistik bulan={bulan} userId={parseInt(params.id)} /> */}
      <Data user={user} />
    </div>
  );
}
