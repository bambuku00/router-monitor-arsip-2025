import DasborPortal from "@/components/pppoe-portal/dasbor";
import {
  PELANGGAN_PORTAL_COOKIE,
  loadPortalAccount,
  portalLoginPathForPelanggan,
  readPelangganPortalSession,
  readPelangganPortalSlug,
  revokePelangganPortalSession,
} from "@/lib/pelanggan-portal";
import { listPortalTiketForPelanggan } from "@/lib/portal-tiket";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portal Pelanggan",
};

export default async function AkunPppoePage() {
  const jar = await cookies();
  const sessionToken = jar.get(PELANGGAN_PORTAL_COOKIE)?.value;
  const pelangganId = readPelangganPortalSession(sessionToken);
  if (!pelangganId) redirect("/pppoe/masuk");

  const akun = await loadPortalAccount(
    pelangganId,
    readPelangganPortalSlug(sessionToken)
  );
  if (!akun) {
    const back = await portalLoginPathForPelanggan(pelangganId);
    revokePelangganPortalSession(sessionToken);
    redirect(back);
  }

  const tiket = await listPortalTiketForPelanggan(pelangganId);
  return <DasborPortal akun={akun} tiket={tiket} />;
}
