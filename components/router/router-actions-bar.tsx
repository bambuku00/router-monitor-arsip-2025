"use client";

import IsolirSetupDialog from "@/components/router/isolir-setup-dialog";
import { Router } from "@prisma/client";

type Props = {
  router: Pick<Router, "id" | "nama" | "os_version">;
  canManage?: boolean;
};

export default function RouterActionsBar({ router, canManage = false }: Props) {
  if (!canManage) return null;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full items-center">
      <div className="hidden sm:block" />
      <p className="hidden sm:flex justify-center font-medium truncate">{router.nama}</p>
      <div className="flex sm:justify-end">
        <IsolirSetupDialog router={router} canManage={canManage} />
      </div>
    </section>
  );
}
