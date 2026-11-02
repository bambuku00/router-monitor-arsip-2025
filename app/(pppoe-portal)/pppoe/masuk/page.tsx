import {
  PELANGGAN_PORTAL_COOKIE,
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

export default async function MasukPelangganPage() {
  const jar = await cookies();
  const pelangganId = readPelangganPortalSession(
    jar.get(PELANGGAN_PORTAL_COOKIE)?.value
  );
  if (pelangganId) redirect("/pppoe");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 pt-[10vh] pb-8">
      <div className="flex flex-col rounded-3xl bg-white px-6 pt-10 pb-6 shadow-sm dark:bg-theme-card">
        <div className="flex justify-center">
          <Image src={Logo} alt="WINET" className="h-auto w-36" priority />
        </div>
        <p className="mt-8 text-center text-sm text-slate-600">
          Gunakan link dari mitra Anda.
        </p>
      </div>
    </div>
  );
}
