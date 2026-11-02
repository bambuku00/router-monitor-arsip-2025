import CardClient from "@/components/router/card-client";
import CardTraffic from "@/components/router/card-traffic";
import CardsRouter from "@/components/router/cards";
import RouterActionsBar from "@/components/router/router-actions-bar";
import RouterPageShell from "@/components/router/router-page-shell";
import { validateRequest } from "@/lib/auth";
import {
  assertRouterIdAccess,
  resolveRouterIdAccess,
} from "@/lib/router-page-access";
import { requirePageAccess } from "@/lib/route-access";
import { canManageRouterConfig } from "@/lib/router-manage-access";
import prisma from "@/lib/prisma";
import { Metadata, ResolvingMetadata } from "next";
import { redirect, notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
export async function generateMetadata(
  props: Props,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  return {
    title: "Router Monitoring | Router",
    description: "Traffic performa router",
  };
}
export default async function Router(props: Props) {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  const params = await props.params;
  const rawId = params.id ?? "";
  requirePageAccess(user, `/router/${rawId}`);

  const routerId = assertRouterIdAccess(
    await resolveRouterIdAccess(user, rawId)
  );

  const router = await prisma.router.findFirst({
    where: { id: routerId, deleted: false },
    select: {
      id: true,
      nama: true,
      os_version: true,
    },
  });

  if (!router) notFound();

  const canManageIsolir = canManageRouterConfig(user);

  return (
    <RouterPageShell>
      <RouterActionsBar
        router={{
          id: router.id,
          nama: router.nama,
          os_version: router.os_version,
        }}
        canManage={canManageIsolir}
      />
      <CardsRouter id={routerId} />
      <section className="grid sm:grid-cols-3 gap-6 w-full">
        <CardTraffic id={routerId} />
        <CardClient id={routerId} />
      </section>
    </RouterPageShell>
  );
}
