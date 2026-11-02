import Data from "@/components/users/data";
import { validateRequest } from "@/lib/auth";
import { requirePageAccess } from "@/lib/route-access";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOwnedResourcesUserId } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Router Monitoring | Users List",
  description: "List paket pelanggan",
};
export default async function Users() {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");
  requirePageAccess(user, "/users");

  /** Hanya field yang dipakai components/users/data.tsx (list + dialog edit). Password Argon2 TIDAK di-select. */
  const userListSelect = {
    id: true,
    nama: true,
    user: true,
    role: true,
    parentId: true,
    omset: true,
    ppn: true,
    disabled: true,
    verified: true,
    created: true,
    nomor: true,
    alamat: true,
    revenueBasis: true,
    billingStartMode: true,
    billingStartDate: true,
    billingGenerateDay: true,
    freeCustomerLimit: true,
    pppPackageChangeLimit: true,
    pppAutoFillEnabled: true,
    portalPelangganEnabled: true,
    portalSlug: true,
    ownedByIsp: true,
    revenueShareEnabled: true,
    staffMenuKeys: true,
    staffAllowBankPayment: true,
    staffAllowIsolir: true,
    staffAllowCancelPayment: true,
    staffAllowBerhenti: true,
    identitas: true,
    no_identitas: true,
    npwp: true,
  } as const;

  let users;
  if (user.role === "Superadmin") {
    users = await prisma.user.findMany({
      where: { role: { not: "Petugas" } },
      select: {
        ...userListSelect,
        parent: { select: { id: true, nama: true } },
        client: {
          include: {
            perorangan: true,
            layanan: true,
          },
        },
      },
    });
  } else {
    const mitraId = getOwnedResourcesUserId(user);
    users = await prisma.user.findMany({
      where:
        user.id === mitraId
          ? {
              role: { not: "Petugas" },
              OR: [{ id: user.id }, { parentId: user.id }],
            }
          : { parentId: mitraId, role: { not: "Petugas" } },
      select: userListSelect,
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      <Data users={users} user={user} />
    </div>
  );
}
