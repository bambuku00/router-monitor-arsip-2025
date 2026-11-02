import CetakRekapMetode from "@/components/penagihan/cetak-rekap-metode";
import { guardHomePage } from "@/lib/home-page-guard";
import { loadPenagihRekapMetode } from "@/lib/penagih-rekap-metode-load";
import { parsePenagihanPeriod } from "@/lib/penagih-cetak";
import { resolvePenagihanOwner } from "@/lib/penagih";
import prisma from "@/lib/prisma";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rincian tagihan petugas",
};

export default async function PenagihRekapCetakPage(props: {
  searchParams: Promise<{
    bulan?: string;
    mitraId?: string;
    penagihId?: string;
  }>;
}) {
  const { user } = await guardHomePage("/petugas/cetak/rekap");
  const searchParams = await props.searchParams;
  const bulan = parsePenagihanPeriod(searchParams.bulan);
  if (!bulan) {
    return <p className="p-6 text-sm">Periode tagihan tidak valid.</p>;
  }

  if (user.role === "Petugas") {
    const own = await prisma.penagih.findFirst({
      where: { userId: user.id, aktif: true },
      select: { id: true, ownerUserId: true },
    });
    if (!own) {
      return <p className="p-6 text-sm">Berkas rincian tidak tersedia.</p>;
    }
    const data = await loadPenagihRekapMetode({
      ownerUserId: own.ownerUserId,
      penagihId: own.id,
      bulan,
    });
    if (!data) {
      return <p className="p-6 text-sm">Berkas rincian tidak tersedia.</p>;
    }
    return (
      <CetakRekapMetode
        bulan={data.bulan}
        penagihNama={data.penagih.nama}
        rows={data.data}
      />
    );
  }

  const requested = Number(searchParams.mitraId);
  const scope = await resolvePenagihanOwner(
    user,
    Number.isInteger(requested) && requested > 0 ? requested : null
  );
  const penagihId = Number(searchParams.penagihId);
  if (!scope.ok || !Number.isInteger(penagihId) || penagihId <= 0) {
    return (
      <p className="p-6 text-sm">
        {scope.ok ? "Petugas wajib dipilih." : scope.error}
      </p>
    );
  }

  const data = await loadPenagihRekapMetode({
    ownerUserId: scope.ownerUserId,
    penagihId,
    bulan,
  });
  if (!data) {
    return <p className="p-6 text-sm">Petugas tidak ditemukan.</p>;
  }

  return (
    <CetakRekapMetode
      bulan={data.bulan}
      penagihNama={data.penagih.nama}
      rows={data.data}
    />
  );
}
