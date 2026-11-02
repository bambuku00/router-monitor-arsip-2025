import PenagihanBoard from "@/components/penagihan/board";
import { guardHomePage } from "@/lib/home-page-guard";
import { listPetugasBoard } from "@/lib/penagih";
import prisma from "@/lib/prisma";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router Monitoring | Petugas",
};

export default async function PenagihanPage() {
  const { user } = await guardHomePage("/petugas");
  const mitras =
    user.role === "Superadmin"
      ? await prisma.user.findMany({
          where: { role: "Admin", parentId: null },
          orderBy: { nama: "asc" },
          select: { id: true, nama: true },
        })
      : [];
  const ownerUserId =
    user.role === "Superadmin"
      ? null
      : getOwnedResourcesUserId({
          id: user.id,
          role: user.role,
          parentId: user.parentId ?? undefined,
        });

  const initialPetugas = ownerUserId == null ? [] : await listPetugasBoard(ownerUserId);

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full pb-20">
      <PenagihanBoard
        ownerUserId={ownerUserId}
        mitras={mitras}
        initialPetugas={initialPetugas}
      />
    </div>
  );
}
