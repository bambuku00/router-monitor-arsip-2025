import Data from "@/components/pembayaran/data";
import PilihMitraPenagihan from "@/components/penagihan/pilih-mitra";
import { guardHomePage } from "@/lib/home-page-guard";
import prisma from "@/lib/prisma";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Data Penagih",
  description: "Data tagihan menurut penagih",
};

export default async function DataPenagihPage(props: {
  searchParams: Promise<{ mitraId?: string; staff?: string }>;
}) {
  const { user } = await guardHomePage("/data-penagih");
  const searchParams = await props.searchParams;
  const mitras =
    user.role === "Superadmin"
      ? await prisma.user.findMany({
          where: { role: "Admin", parentId: null },
          orderBy: { nama: "asc" },
          select: { id: true, nama: true },
        })
      : [];

  const requested = Number(searchParams.mitraId);
  const ownerUserId =
    user.role === "Superadmin"
      ? mitras.some((mitra) => mitra.id === requested)
        ? requested
        : null
      : getOwnedResourcesUserId({
          id: user.id,
          role: user.role,
          parentId: user.parentId ?? undefined,
        });

  return (
    <div className="flex w-full flex-col items-center gap-4 bg-white pb-20 text-slate-700 dark:bg-theme-bg dark:text-theme-fg">
      {user.role === "Superadmin" ? (
        <div className="flex w-full justify-start px-1">
          <PilihMitraPenagihan mitras={mitras} selectedId={ownerUserId} />
        </div>
      ) : null}
      {ownerUserId ? (
        <Data user={user} mode="penagih" mitraUserId={ownerUserId} />
      ) : (
        <p className="py-16 text-sm text-slate-500">
          Pilih mitra untuk melihat data penagih.
        </p>
      )}
    </div>
  );
}
