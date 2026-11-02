import CetakBerkasPenagihan from "@/components/penagihan/cetak-berkas";
import { guardHomePage } from "@/lib/home-page-guard";
import { loadPenagihanCetak, parsePenagihanPeriod } from "@/lib/penagih-cetak";
import { resolvePenagihanOwner } from "@/lib/penagih";
import prisma from "@/lib/prisma";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Berkas penagihan",
};

export default async function PenagihanCetakPage(props: {
  searchParams: Promise<{ periode?: string; mitraId?: string; penagihId?: string }>;
}) {
  const { user } = await guardHomePage("/petugas/cetak");
  const searchParams = await props.searchParams;
  if (user.role === "Petugas") {
    const own = await prisma.penagih.findFirst({
      where: { userId: user.id, aktif: true },
      select: { id: true, ownerUserId: true },
    });
    const period = parsePenagihanPeriod(searchParams.periode);
    if (!own || !period) {
      return <p className="p-6 text-sm">Berkas penagihan tidak tersedia.</p>;
    }
    const data = await loadPenagihanCetak({
      ownerUserId: own.ownerUserId,
      period,
      penagihId: own.id,
    });
    return <CetakBerkasPenagihan period={data.period} groups={data.groups} />;
  }
  const requested = Number(searchParams.mitraId);
  const scope = await resolvePenagihanOwner(
    user,
    Number.isInteger(requested) && requested > 0 ? requested : null
  );
  const period = parsePenagihanPeriod(searchParams.periode);
  if (!scope.ok || !period) {
    return (
      <p className="p-6 text-sm">
        {scope.ok ? "Periode tagihan tidak valid." : scope.error}
      </p>
    );
  }
  const penagihId = Number(searchParams.penagihId);
  const data = await loadPenagihanCetak({
    ownerUserId: scope.ownerUserId,
    period,
    penagihId: Number.isInteger(penagihId) && penagihId > 0 ? penagihId : null,
  });

  return (
    <CetakBerkasPenagihan period={data.period} groups={data.groups} />
  );
}
