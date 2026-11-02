import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Paket, Pembayaran } from "@prisma/client";
import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { nominalPaketForDisplay } from "@/lib/paket-persist";
import {
  ppnNominalPerBaris,
} from "@/lib/pembayaran-tax";
import {
  computeRegulatoryAmounts,
  DEFAULT_REGULATORY_SETTINGS,
  type RegulatorySettingsInput,
} from "@/lib/regulatory-calc";

export type HitunganInvoiceRow = Pick<
  Pembayaran,
  "id" | "total" | "status"
>;

export type HitunganPaketRow = Pick<
  Paket,
  "id" | "nama" | "harga" | "nominalPembayaran"
> & {
  pembayaran: HitunganInvoiceRow[];
  berhenti: number;
  gratis: number;
  belumWaktunya: number;
};

export type HitunganRegulatorySettings = Pick<
  RegulatorySettingsInput,
  "bhpEnabled" | "bhpPercent" | "usoEnabled" | "usoPercent"
>;

type Props = {
  data: HitunganPaketRow[];
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  ppn: number | null;
  showPpn?: boolean;
  regulatory?: HitunganRegulatorySettings | null;
  loading?: boolean;
};

function colAktif(showPpn: boolean) {
  return showPpn ? 11 : 9;
}
function colPotensial(showPpn: boolean) {
  return showPpn ? 10 : 8;
}

const cellClass =
  "whitespace-nowrap px-4 py-3 tabular-nums text-sm sm:text-base";
const cellRight = `${cellClass} text-right`;
const cellCenter = `${cellClass} text-center`;

const thGroup =
  "border border-slate-200 bg-slate-400/90 px-4 py-2.5 text-xs sm:text-sm font-semibold text-center";
const thSub =
  "border border-slate-200 bg-slate-300/90 px-4 py-2.5 text-xs sm:text-sm font-medium";

function formatIdr(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function aggregateTagihan(
  pembayaran: HitunganInvoiceRow[],
  paketHarga: number,
  ppnPct: number,
  regulatory: RegulatorySettingsInput
) {
  const sumGross = pembayaran.reduce((s, p) => s + Number(p.total), 0);
  const sumPPN = pembayaran.reduce(
    (s, p) => s + ppnNominalPerBaris(p.total, paketHarga, ppnPct),
    0
  );
  const { bhpAmount, usoAmount } = computeRegulatoryAmounts(
    sumGross,
    regulatory
  );
  return {
    count: pembayaran.length,
    sumGross,
    sumPPN,
    sumBhp: bhpAmount,
    sumUso: usoAmount,
  };
}

type AktifTotals = {
  jumlahTagihan: number;
  gratis: number;
  bayarTotal: number;
  bayarPPN: number;
  bayarBHP: number;
  bayarUSO: number;
};

type BerhentiTotals = {
  berhenti: number;
  bayarTotal: number;
  bayarPPN: number;
  bayarBHP: number;
  bayarUSO: number;
};

type BelumWaktunyaTotals = {
  belumWaktunya: number;
  bayarTotal: number;
  bayarPPN: number;
  bayarBHP: number;
  bayarUSO: number;
};

function foldAktifRows(
  pakets: HitunganPaketRow[],
  ppnPct: number,
  regulatory: RegulatorySettingsInput
): AktifTotals {
  let jumlahTagihan = 0;
  let gratis = 0;
  let bayarTotal = 0;
  let bayarPPN = 0;
  let bayarBHP = 0;
  let bayarUSO = 0;

  pakets.forEach((paket) => {
    const a = aggregateTagihan(
      paket.pembayaran,
      paket.harga,
      ppnPct,
      regulatory
    );
    jumlahTagihan += a.count;
    gratis += paket.gratis;
    bayarTotal += a.sumGross;
    bayarPPN += a.sumPPN;
    bayarBHP += a.sumBhp;
    bayarUSO += a.sumUso;
  });

  return {
    jumlahTagihan,
    gratis,
    bayarTotal,
    bayarPPN,
    bayarBHP,
    bayarUSO,
  };
}

function aggregatePotensialTagihan(
  jumlahPelanggan: number,
  paketHarga: number,
  ppnPct: number,
  regulatory: RegulatorySettingsInput
) {
  if (jumlahPelanggan <= 0) {
    return { sumGross: 0, sumPPN: 0, sumBhp: 0, sumUso: 0 };
  }
  const unitBruto = nominalPaketForDisplay(
    { harga: paketHarga, nominalPembayaran: null },
    ppnPct
  );
  const sumGross = unitBruto * jumlahPelanggan;
  const unitPPN = unitBruto - Math.round(Number(paketHarga));
  const sumPPN = unitPPN * jumlahPelanggan;
  const { bhpAmount, usoAmount } = computeRegulatoryAmounts(
    sumGross,
    regulatory
  );
  return {
    sumGross,
    sumPPN,
    sumBhp: bhpAmount,
    sumUso: usoAmount,
  };
}

function foldBerhentiRows(
  pakets: HitunganPaketRow[],
  ppnPct: number,
  regulatory: RegulatorySettingsInput
): BerhentiTotals {
  let berhenti = 0;
  let bayarTotal = 0;
  let bayarPPN = 0;
  let bayarBHP = 0;
  let bayarUSO = 0;

  pakets.forEach((paket) => {
    berhenti += paket.berhenti;
    const a = aggregatePotensialTagihan(
      paket.berhenti,
      paket.harga,
      ppnPct,
      regulatory
    );
    bayarTotal += a.sumGross;
    bayarPPN += a.sumPPN;
    bayarBHP += a.sumBhp;
    bayarUSO += a.sumUso;
  });

  return { berhenti, bayarTotal, bayarPPN, bayarBHP, bayarUSO };
}

function foldBelumWaktunyaRows(
  pakets: HitunganPaketRow[],
  ppnPct: number,
  regulatory: RegulatorySettingsInput
): BelumWaktunyaTotals {
  let belumWaktunya = 0;
  let bayarTotal = 0;
  let bayarPPN = 0;
  let bayarBHP = 0;
  let bayarUSO = 0;

  pakets.forEach((paket) => {
    belumWaktunya += paket.belumWaktunya;
    const a = aggregatePotensialTagihan(
      paket.belumWaktunya,
      paket.harga,
      ppnPct,
      regulatory
    );
    bayarTotal += a.sumGross;
    bayarPPN += a.sumPPN;
    bayarBHP += a.sumBhp;
    bayarUSO += a.sumUso;
  });

  return { belumWaktunya, bayarTotal, bayarPPN, bayarBHP, bayarUSO };
}

function hasAktifRow(row: HitunganPaketRow) {
  return row.pembayaran.length > 0 || row.gratis > 0;
}

function HitunganTableHeadAktif({ showPpn }: { showPpn: boolean }) {
  const tarifSpan = showPpn ? 3 : 2;
  const nilaiSpan = showPpn ? 4 : 3;
  return (
    <>
      <tr>
        <th rowSpan={2} className={`${thSub} text-left`}>
          No.
        </th>
        <th rowSpan={2} className={`${thSub} text-left`}>
          Paket
        </th>
        <th colSpan={tarifSpan} className={thGroup}>
          Tarif per pelanggan / bln
        </th>
        <th colSpan={2} className={thGroup}>
          Jumlah pelanggan
        </th>
        <th colSpan={nilaiSpan} className={thGroup}>
          Nilai tagihan bulan ini
        </th>
      </tr>
      <tr>
        <th className={`${thSub} text-right`}>Harga (DPP)</th>
        {showPpn ? (
          <th className={`${thSub} text-right`}>PPN</th>
        ) : null}
        <th className={`${thSub} text-right`}>Tagihan</th>
        <th className={`${thSub} text-center`}>Tagihan</th>
        <th className={`${thSub} text-center`}>Gratis</th>
        <th className={`${thSub} text-right`}>Total Tagihan</th>
        {showPpn ? (
          <th className={`${thSub} text-right`}>Total PPN</th>
        ) : null}
        <th className={`${thSub} text-right`}>BHP</th>
        <th className={`${thSub} text-right`}>USO</th>
      </tr>
    </>
  );
}

function HitunganTableHeadBelumWaktunya({ showPpn }: { showPpn: boolean }) {
  const tarifSpan = showPpn ? 3 : 2;
  const nilaiSpan = showPpn ? 4 : 3;
  return (
    <>
      <tr>
        <th rowSpan={2} className={`${thSub} text-left`}>
          No.
        </th>
        <th rowSpan={2} className={`${thSub} text-left`}>
          Paket
        </th>
        <th colSpan={tarifSpan} className={thGroup}>
          Tarif per pelanggan / bln
        </th>
        <th colSpan={1} className={thGroup}>
          Jumlah pelanggan
        </th>
        <th colSpan={nilaiSpan} className={thGroup}>
          Nilai potensial (jumlah × tarif)
        </th>
      </tr>
      <tr>
        <th className={`${thSub} text-right`}>Harga (DPP)</th>
        {showPpn ? (
          <th className={`${thSub} text-right`}>PPN</th>
        ) : null}
        <th className={`${thSub} text-right`}>Tagihan</th>
        <th className={`${thSub} text-center`}>Belum Waktunya</th>
        <th className={`${thSub} text-right`}>Total Tagihan</th>
        {showPpn ? (
          <th className={`${thSub} text-right`}>Total PPN</th>
        ) : null}
        <th className={`${thSub} text-right`}>BHP</th>
        <th className={`${thSub} text-right`}>USO</th>
      </tr>
    </>
  );
}

function HitunganTableHeadBerhenti({ showPpn }: { showPpn: boolean }) {
  const tarifSpan = showPpn ? 3 : 2;
  const nilaiSpan = showPpn ? 4 : 3;
  return (
    <>
      <tr>
        <th rowSpan={2} className={`${thSub} text-left`}>
          No.
        </th>
        <th rowSpan={2} className={`${thSub} text-left`}>
          Paket
        </th>
        <th colSpan={tarifSpan} className={thGroup}>
          Tarif per pelanggan / bln
        </th>
        <th colSpan={1} className={thGroup}>
          Jumlah pelanggan
        </th>
        <th colSpan={nilaiSpan} className={thGroup}>
          Nilai potensial (jumlah × tarif)
        </th>
      </tr>
      <tr>
        <th className={`${thSub} text-right`}>Harga (DPP)</th>
        {showPpn ? (
          <th className={`${thSub} text-right`}>PPN</th>
        ) : null}
        <th className={`${thSub} text-right`}>Tagihan</th>
        <th className={`${thSub} text-center`}>Berhenti</th>
        <th className={`${thSub} text-right`}>Total Tagihan</th>
        {showPpn ? (
          <th className={`${thSub} text-right`}>Total PPN</th>
        ) : null}
        <th className={`${thSub} text-right`}>BHP</th>
        <th className={`${thSub} text-right`}>USO</th>
      </tr>
    </>
  );
}

function HitunganTableAktifBody({
  rows,
  totals,
  ppnPct,
  regulatory,
  showPpn,
}: {
  rows: HitunganPaketRow[];
  totals: AktifTotals;
  ppnPct: number;
  regulatory: RegulatorySettingsInput;
  showPpn: boolean;
}) {
  if (rows.length === 0) {
    return (
      <tr>
        <td
          colSpan={colAktif(showPpn)}
          className="px-6 py-12 text-center text-slate-500 text-sm sm:text-base border border-slate-200"
        >
          Tidak ada tagihan atau gratis pada bulan ini
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((val, i) => {
        const unitBruto = nominalPaketForDisplay(val, ppnPct);
        const unitPPN = unitBruto - Math.round(Number(val.harga));
        const agg = aggregateTagihan(
          val.pembayaran,
          val.harga,
          ppnPct,
          regulatory
        );
        return (
          <tr
            className="bg-slate-50/90 hover:bg-slate-100/90 *:border *:border-slate-200"
            key={`aktif-${val.id}-${val.nama}`}
          >
            <td className={cellCenter}>{i + 1}.</td>
            <td className={`${cellClass} font-medium text-left`}>{val.nama}</td>
            <td className={cellRight}>{formatIdr(val.harga)}</td>
            {showPpn ? (
              <td className={cellRight}>{formatIdr(unitPPN)}</td>
            ) : null}
            <td className={cellRight}>{formatIdr(unitBruto)}</td>
            <td className={cellCenter}>{agg.count}</td>
            <td className={cellCenter}>{val.gratis}</td>
            <td className={cellRight}>{formatIdr(agg.sumGross)}</td>
            {showPpn ? (
              <td className={cellRight}>{formatIdr(agg.sumPPN)}</td>
            ) : null}
            <td className={cellRight}>{formatIdr(agg.sumBhp)}</td>
            <td className={cellRight}>{formatIdr(agg.sumUso)}</td>
          </tr>
        );
      })}
      <tr className="bg-slate-200/90 font-semibold text-sm *:border *:border-slate-200">
        <td
          colSpan={showPpn ? 5 : 4}
          className="px-4 py-3 text-right text-sm sm:text-base"
        >
          Total
        </td>
        <td className={cellCenter}>{totals.jumlahTagihan}</td>
        <td className={cellCenter}>{totals.gratis}</td>
        <td className={cellRight}>{formatIdr(totals.bayarTotal)}</td>
        {showPpn ? (
          <td className={cellRight}>{formatIdr(totals.bayarPPN)}</td>
        ) : null}
        <td className={cellRight}>{formatIdr(totals.bayarBHP)}</td>
        <td className={cellRight}>{formatIdr(totals.bayarUSO)}</td>
      </tr>
    </>
  );
}

function HitunganTableBelumWaktunyaBody({
  rows,
  totals,
  ppnPct,
  regulatory,
  showPpn,
}: {
  rows: HitunganPaketRow[];
  totals: BelumWaktunyaTotals;
  ppnPct: number;
  regulatory: RegulatorySettingsInput;
  showPpn: boolean;
}) {
  if (rows.length === 0) {
    return (
      <tr>
        <td
          colSpan={colPotensial(showPpn)}
          className="px-6 py-12 text-center text-slate-500 text-sm sm:text-base border border-slate-200"
        >
          Tidak ada pelanggan belum waktunya tagihan
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((val, i) => {
        const unitBruto = nominalPaketForDisplay(val, ppnPct);
        const unitPPN = unitBruto - Math.round(Number(val.harga));
        const agg = aggregatePotensialTagihan(
          val.belumWaktunya,
          val.harga,
          ppnPct,
          regulatory
        );
        return (
          <tr
            className="bg-slate-50/90 hover:bg-slate-100/90 *:border *:border-slate-200"
            key={`belum-waktunya-${val.id}-${val.nama}`}
          >
            <td className={cellCenter}>{i + 1}.</td>
            <td className={`${cellClass} font-medium text-left`}>{val.nama}</td>
            <td className={cellRight}>{formatIdr(val.harga)}</td>
            {showPpn ? (
              <td className={cellRight}>{formatIdr(unitPPN)}</td>
            ) : null}
            <td className={cellRight}>{formatIdr(unitBruto)}</td>
            <td className={cellCenter}>{val.belumWaktunya}</td>
            <td className={cellRight}>{formatIdr(agg.sumGross)}</td>
            {showPpn ? (
              <td className={cellRight}>{formatIdr(agg.sumPPN)}</td>
            ) : null}
            <td className={cellRight}>{formatIdr(agg.sumBhp)}</td>
            <td className={cellRight}>{formatIdr(agg.sumUso)}</td>
          </tr>
        );
      })}
      <tr className="bg-slate-200/90 font-semibold text-sm *:border *:border-slate-200">
        <td
          colSpan={showPpn ? 5 : 4}
          className="px-4 py-3 text-right text-sm sm:text-base"
        >
          Total
        </td>
        <td className={cellCenter}>{totals.belumWaktunya}</td>
        <td className={cellRight}>{formatIdr(totals.bayarTotal)}</td>
        {showPpn ? (
          <td className={cellRight}>{formatIdr(totals.bayarPPN)}</td>
        ) : null}
        <td className={cellRight}>{formatIdr(totals.bayarBHP)}</td>
        <td className={cellRight}>{formatIdr(totals.bayarUSO)}</td>
      </tr>
    </>
  );
}

function HitunganTableBerhentiBody({
  rows,
  totals,
  ppnPct,
  regulatory,
  showPpn,
}: {
  rows: HitunganPaketRow[];
  totals: BerhentiTotals;
  ppnPct: number;
  regulatory: RegulatorySettingsInput;
  showPpn: boolean;
}) {
  if (rows.length === 0) {
    return (
      <tr>
        <td
          colSpan={colPotensial(showPpn)}
          className="px-6 py-12 text-center text-slate-500 text-sm sm:text-base border border-slate-200"
        >
          Tidak ada pelanggan berhenti
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((val, i) => {
        const unitBruto = nominalPaketForDisplay(val, ppnPct);
        const unitPPN = unitBruto - Math.round(Number(val.harga));
        const agg = aggregatePotensialTagihan(
          val.berhenti,
          val.harga,
          ppnPct,
          regulatory
        );
        return (
          <tr
            className="bg-slate-50/90 hover:bg-slate-100/90 *:border *:border-slate-200"
            key={`berhenti-${val.id}-${val.nama}`}
          >
            <td className={cellCenter}>{i + 1}.</td>
            <td className={`${cellClass} font-medium text-left`}>{val.nama}</td>
            <td className={cellRight}>{formatIdr(val.harga)}</td>
            {showPpn ? (
              <td className={cellRight}>{formatIdr(unitPPN)}</td>
            ) : null}
            <td className={cellRight}>{formatIdr(unitBruto)}</td>
            <td className={cellCenter}>{val.berhenti}</td>
            <td className={cellRight}>{formatIdr(agg.sumGross)}</td>
            {showPpn ? (
              <td className={cellRight}>{formatIdr(agg.sumPPN)}</td>
            ) : null}
            <td className={cellRight}>{formatIdr(agg.sumBhp)}</td>
            <td className={cellRight}>{formatIdr(agg.sumUso)}</td>
          </tr>
        );
      })}
      <tr className="bg-slate-200/90 font-semibold text-sm *:border *:border-slate-200">
        <td
          colSpan={showPpn ? 5 : 4}
          className="px-4 py-3 text-right text-sm sm:text-base"
        >
          Total
        </td>
        <td className={cellCenter}>{totals.berhenti}</td>
        <td className={cellRight}>{formatIdr(totals.bayarTotal)}</td>
        {showPpn ? (
          <td className={cellRight}>{formatIdr(totals.bayarPPN)}</td>
        ) : null}
        <td className={cellRight}>{formatIdr(totals.bayarBHP)}</td>
        <td className={cellRight}>{formatIdr(totals.bayarUSO)}</td>
      </tr>
    </>
  );
}

function HitunganTableSection({
  title,
  titleClassName,
  children,
}: {
  title: string;
  titleClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className={`text-base sm:text-lg font-semibold ${titleClassName ?? ""}`}>
        {title}
      </p>
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        {children}
      </div>
    </section>
  );
}

export default function DialogHitunganPaket({
  show,
  setShow,
  data,
  ppn,
  showPpn = true,
  regulatory,
  loading,
}: Props) {
  const ppnPct = showPpn ? (ppn ?? 11) : 0;

  const regulatorySettings = useMemo(
    (): RegulatorySettingsInput => ({
      ...DEFAULT_REGULATORY_SETTINGS,
      ...regulatory,
    }),
    [regulatory]
  );

  const aktifRows = useMemo(
    () => data.filter(hasAktifRow).sort((a, b) => a.harga - b.harga),
    [data]
  );

  const belumWaktunyaRows = useMemo(
    () =>
      data
        .filter((row) => row.belumWaktunya > 0)
        .sort((a, b) => a.harga - b.harga),
    [data]
  );

  const berhentiRows = useMemo(
    () =>
      data.filter((row) => row.berhenti > 0).sort((a, b) => a.harga - b.harga),
    [data]
  );

  const totalsAktif = useMemo(
    () => foldAktifRows(aktifRows, ppnPct, regulatorySettings),
    [aktifRows, ppnPct, regulatorySettings]
  );

  const totalsBelumWaktunya = useMemo(
    () => foldBelumWaktunyaRows(belumWaktunyaRows, ppnPct, regulatorySettings),
    [belumWaktunyaRows, ppnPct, regulatorySettings]
  );

  const totalsBerhenti = useMemo(
    () => foldBerhentiRows(berhentiRows, ppnPct, regulatorySettings),
    [berhentiRows, ppnPct, regulatorySettings]
  );

  return (
    <Transition show={show} as={React.Fragment}>
      <Dialog
        as="div"
        className="relative z-[1001]"
        onClose={() => setShow(false)}
      >
        <TransitionChild
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-start sm:items-center justify-center p-4 sm:p-6 lg:p-8 text-center">
            <TransitionChild
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-50"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 translate-x-5 scale-95"
            >
              <DialogPanel className="w-[calc(100vw-2rem)] sm:w-[calc(100vw-3rem)] max-w-[96rem] transform overflow-hidden rounded-2xl bg-white text-left text-gray-900 align-middle shadow-xl transition-all flex flex-col max-h-[min(92vh,820px)] my-4 sm:my-6">
                <DialogTitle
                  as="div"
                  className="shrink-0 flex justify-between items-center border-b border-slate-200 px-8 sm:px-10 py-6"
                >
                  <div>
                    <p className="text-xl font-semibold">Hitungan Per Paket</p>
                    <p className="text-sm text-slate-500 mt-1.5">
                      Rekap bulan terpilih — tagihan aktif, belum waktunya, dan
                      pelanggan berhenti terpisah per paket
                    </p>
                  </div>
                </DialogTitle>
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 sm:px-10 py-8 sm:py-10">
                  {loading ? (
                    <div className="flex justify-center items-center py-20 gap-3 text-slate-600">
                      <Loader2 className="animate-spin size-8" />
                      <span className="text-base">Memuat rekap…</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-10 sm:gap-12">
                      <HitunganTableSection title="Tagihan Aktif">
                        <table className="w-full min-w-[960px] border-collapse">
                          <thead>
                            <HitunganTableHeadAktif showPpn={showPpn} />
                          </thead>
                          <tbody>
                            <HitunganTableAktifBody
                              rows={aktifRows}
                              totals={totalsAktif}
                              ppnPct={ppnPct}
                              regulatory={regulatorySettings}
                              showPpn={showPpn}
                            />
                          </tbody>
                        </table>
                      </HitunganTableSection>

                      <HitunganTableSection
                        title="Pelanggan Belum Waktunya"
                        titleClassName="text-amber-700"
                      >
                        <table className="w-full min-w-[960px] border-collapse">
                          <thead>
                            <HitunganTableHeadBelumWaktunya showPpn={showPpn} />
                          </thead>
                          <tbody>
                            <HitunganTableBelumWaktunyaBody
                              rows={belumWaktunyaRows}
                              totals={totalsBelumWaktunya}
                              ppnPct={ppnPct}
                              regulatory={regulatorySettings}
                              showPpn={showPpn}
                            />
                          </tbody>
                        </table>
                      </HitunganTableSection>

                      <HitunganTableSection
                        title="Pelanggan Berhenti"
                        titleClassName="text-red-700"
                      >
                        <table className="w-full min-w-[960px] border-collapse">
                          <thead>
                            <HitunganTableHeadBerhenti showPpn={showPpn} />
                          </thead>
                          <tbody>
                            <HitunganTableBerhentiBody
                              rows={berhentiRows}
                              totals={totalsBerhenti}
                              ppnPct={ppnPct}
                              regulatory={regulatorySettings}
                              showPpn={showPpn}
                            />
                          </tbody>
                        </table>
                      </HitunganTableSection>
                    </div>
                  )}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
