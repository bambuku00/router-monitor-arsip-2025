import { validateRequest } from "@/lib/auth";
import { getPembayaranInScope } from "@/lib/authz";
import {
  redirectToAllowedOrForbidden,
  requirePageAccess,
} from "@/lib/route-access";
import { redirect } from "next/navigation";

/** Legacy URL — langsung unduh PDF. */
export default async function PembayaranKuitansiRedirect(props: {
  params: Promise<{ pembayaranId: string }>;
}) {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  const params = await props.params;
  const pembayaranId = parseInt(params.pembayaranId, 10);
  if (Number.isNaN(pembayaranId)) redirectToAllowedOrForbidden(user);

  requirePageAccess(user, `/pembayaran/${pembayaranId}`);

  const inScope = await getPembayaranInScope(pembayaranId, user);
  if (!inScope) redirect("/forbidden");

  redirect(`/api/pembayaran/invoice/${pembayaranId}/pdf`);
}
