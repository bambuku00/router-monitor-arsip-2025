import DaftarTiket from "@/components/portal-tiket/daftar";
import { guardHomePage } from "@/lib/home-page-guard";
import { listPortalTiketForStaff } from "@/lib/portal-tiket";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Tiket Pelanggan",
};

export const dynamic = "force-dynamic";

export default async function TiketPelangganPage() {
  const { user } = await guardHomePage("/tiket");
  const tiket = await listPortalTiketForStaff(user);

  return (
    <div className="flex w-full flex-col items-center gap-4 bg-white px-3 pb-20 text-slate-700 dark:bg-theme-bg dark:text-theme-fg sm:px-4">
      <DaftarTiket tiket={tiket} />
    </div>
  );
}
