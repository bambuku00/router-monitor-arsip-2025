import { bagiPendapatanBersihMitraKantor } from "@/lib/pembayaran-split";
import type { RevenueBasis, StatusBayar } from "@prisma/client";

export type PembayaranMitraRekapanRow = {
  total: number;
  totalTagihan: number;
  ppn: number;
  bhp: number;
  uso: number;
  bersih: number;
  mitra: number;
  kantor: number;
  bayar: number;
  tagihanKantor: number;
  saldo: number;
  status: StatusBayar;
  revenueBasis: RevenueBasis;
};

export function buildMitraRekapanRow(
  total: number,
  ppn: number,
  bhp: number,
  uso: number,
  omset: number | null,
  paidSum: number,
  options?: {
    totalTagihan?: number;
    revenueBasis?: RevenueBasis;
    /** false = akun milik ISP dengan bagi hasil dimatikan. */
    revenueShareEnabled?: boolean;
  }
): PembayaranMitraRekapanRow {
  const bhpUso = bhp + uso;
  const bersih = Math.max(0, total - ppn - bhpUso);
  const shareEnabled = options?.revenueShareEnabled !== false;
  const { mitra, kantor } = bagiPendapatanBersihMitraKantor(
    bersih,
    omset,
    shareEnabled
  );
  const tagihanKantor = kantor + ppn + bhpUso;
  const bayar = Math.min(paidSum, tagihanKantor);

  return {
    total,
    totalTagihan: options?.totalTagihan ?? total,
    ppn,
    bhp,
    uso,
    bersih,
    mitra,
    kantor,
    bayar,
    tagihanKantor,
    saldo: tagihanKantor - bayar,
    status: bayar >= tagihanKantor && tagihanKantor > 0 ? "Terbayar" : "Belum",
    revenueBasis: options?.revenueBasis ?? "INVOICE",
  };
}
