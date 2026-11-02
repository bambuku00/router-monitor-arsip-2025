import { validateRequest } from "@/lib/auth";
import {
  assertRouterIdAccess,
  resolveRouterIdAccess,
} from "@/lib/router-page-access";
import PppLoadError from "@/components/router/ppp/ppp-load-error";
import Data from "@/components/router/ppp/data";
import TooltipTotal from "@/components/router/ppp/tooltip-total";
import RouterPageShell from "@/components/router/router-page-shell";
import { requirePageAccess } from "@/lib/route-access";
import prisma from "@/lib/prisma";
import { Paket } from "@prisma/client";
import { getPaketByUser } from "@/lib/server-actions/paket/actions";
import { getPPP } from "@/lib/server-actions/router/ppp/actions";
import { getPppFreeCustomerQuotaStats } from "@/lib/ppp-page-stats";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RouterPPP(props: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  const params = await props.params;
  const rawId = params.id ?? "";
  requirePageAccess(user, `/router/${rawId}/ppp`);

  const routerId = assertRouterIdAccess(
    await resolveRouterIdAccess(user, rawId)
  );

  const router = await prisma.router.findFirst({
    where: { id: routerId, deleted: false },
    select: {
      id: true,
      lat: true,
      lng: true,
      nama: true,
      os_version: true,
      isolirProfileName: true,
      userId: true,
      users: {
        select: {
          ppn: true,
        },
      },
    },
  });

  if (!router) notFound();

  const pppResult = await getPPP(router.id);
  if ("error" in pppResult) {
    return (
      <RouterPageShell>
        <PppLoadError
          message={pppResult.error}
          routerId={router.id}
          routerName={router.nama}
        />
      </RouterPageShell>
    );
  }

  let paket: Paket[] | undefined;
  let freeQuotaStats:
    | Awaited<ReturnType<typeof getPppFreeCustomerQuotaStats>>
    | undefined;
  if (router.userId) {
    const [paketResult, stats] = await Promise.all([
      getPaketByUser(router.userId),
      getPppFreeCustomerQuotaStats(router.userId),
    ]);
    paket = "data" in paketResult ? paketResult.data : undefined;
    freeQuotaStats = stats;
  }

  return (
    <RouterPageShell>
      <Data
        data={pppResult.data}
        paket={paket}
        syncTime={pppResult.syncTime}
        router={router}
        ppn={router.users?.ppn}
        role={user.role}
        freeQuotaStats={freeQuotaStats}
        packageChangeQuota={pppResult.packageChangeQuota}
      />
      <TooltipTotal totalTagih={pppResult.totalTagih} />
    </RouterPageShell>
  );
}
