import AuthInfoLinks from "@/components/auth/info-links";
import FormMasukPelanggan from "@/components/pppoe-portal/form-masuk";
import {
  PELANGGAN_PORTAL_COOKIE,
  findEnabledPortalOwner,
  readPelangganPortalSession,
} from "@/lib/pelanggan-portal";
import Logo from "@/public/logo.png";
import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portal Pelanggan",
};

export default async function MasukMitraPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jar = await cookies();
  const pelangganId = readPelangganPortalSession(
    jar.get(PELANGGAN_PORTAL_COOKIE)?.value
  );
  if (pelangganId) redirect("/pppoe");

  const owner = await findEnabledPortalOwner(slug);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 pt-[10vh] pb-8">
      <div className="flex flex-col rounded-3xl bg-white px-6 pt-10 pb-6 shadow-sm dark:bg-theme-card">
        <div className="flex justify-center">
          <Image src={Logo} alt="WINET" className="h-auto w-36" priority />
        </div>
        {owner ? (
          <p className="mt-6 text-center text-sm text-slate-500">{owner.nama}</p>
        ) : null}
        <div className="mt-8">
          {owner ? (
            <FormMasukPelanggan slug={owner.slug} />
          ) : (
            <p className="text-center text-sm text-slate-600" role="alert">
              Portal ini tidak tersedia.
            </p>
          )}
        </div>
      </div>
      <AuthInfoLinks />
    </div>
  );
}
