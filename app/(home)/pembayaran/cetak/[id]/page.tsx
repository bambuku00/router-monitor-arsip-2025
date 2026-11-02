import CetakLaporan from "@/components/pembayaran/cetak-laporan";
import {
  cetakDataForAudience,
  showsPppUsername,
} from "@/lib/pembayaran-petugas-response";
import { validateRequest } from "@/lib/auth";
import {
  getPembayaranCetakData,
  parsePembayaranCetakBayarFilter,
} from "@/lib/pembayaran-cetak";
import { parseIsolirPelangganFilter } from "@/lib/pembayaran-isolir-filter";
import { clampPetugasBulan } from "@/lib/petugas-bulan";
import { canAccessUser } from "@/lib/rbac";
import {
  redirectToAllowedOrForbidden,
  requirePageAccess,
} from "@/lib/route-access";
import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: " ",
  description: "Cetak daftar pelanggan belum dan sudah bayar",
};

function buildBackHref(
  mitraUserId: number,
  searchParams: {
    staff?: string;
    bayar?: string;
    isolir?: string;
    router?: string;
  }
) {
  const params = new URLSearchParams();
  if (searchParams.staff?.trim()) params.set("staff", searchParams.staff.trim());
  if (searchParams.bayar?.trim() && searchParams.bayar !== "semua") {
    params.set("bayar", searchParams.bayar.trim());
  }
  if (searchParams.isolir?.trim() && searchParams.isolir !== "semua") {
    params.set("isolir", searchParams.isolir.trim());
  }
  if (searchParams.router?.trim()) params.set("router", searchParams.router.trim());
  const qs = params.toString();
  return qs ? `/pembayaran/${mitraUserId}?${qs}` : `/pembayaran/${mitraUserId}`;
}

export default async function PembayaranCetakPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    bulan?: string;
    staff?: string;
    bayar?: string;
    isolir?: string;
    router?: string;
  }>;
}) {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  const params = await props.params;
  const searchParams = await props.searchParams;
  const mitraUserId = parseInt(params.id, 10);
  if (Number.isNaN(mitraUserId)) redirectToAllowedOrForbidden(user);

  requirePageAccess(user, `/pembayaran/${mitraUserId}`);

  if (user.role !== "Superadmin" && !canAccessUser(user, mitraUserId)) {
    redirectToAllowedOrForbidden(user);
  }

  const bulanParam = searchParams.bulan?.trim();
  const staffAs = searchParams.staff?.trim() || null;
  const bayarFilter = parsePembayaranCetakBayarFilter(searchParams.bayar);
  const isolirFilter = parseIsolirPelangganFilter(searchParams.isolir);
  const routerParam = parseInt(searchParams.router?.trim() || "", 10);
  const routerId =
    Number.isFinite(routerParam) && routerParam > 0 ? routerParam : null;
  const now = new Date();
  const bulanRequested =
    bulanParam && /^\d{4}-\d{2}$/.test(bulanParam)
      ? bulanParam
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const bulan =
    user.role === "Petugas"
      ? clampPetugasBulan(bulanRequested, now)
      : bulanRequested;

  const data = await getPembayaranCetakData(mitraUserId, bulan, user, {
    staffAs,
    bayar: bayarFilter,
    isolir: isolirFilter,
    routerId,
  });
  if (!data) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-slate-600">
        <p>Data cetak tidak ditemukan.</p>
        <Link
          href={buildBackHref(mitraUserId, searchParams)}
          className="text-sky-700 underline mt-4 inline-block"
        >
          Kembali ke pembayaran
        </Link>
      </div>
    );
  }

  return (
    <CetakLaporan
      data={cetakDataForAudience(user.role, data)}
      showPppUsername={showsPppUsername(user.role)}
    />
  );
}
