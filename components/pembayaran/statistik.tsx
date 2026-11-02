import { SelectMonth } from "@/components/input";
import { clampPetugasBulan, petugasVisibleMonths } from "@/lib/petugas-bulan";
import { KomisiPetugasRingkas } from "@/components/pembayaran/komisi-petugas";
import { cn } from "@/lib/utils";
import { Tooltip } from "@mui/material";
import { Loader2, Printer, User } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { IoMdArrowRoundForward } from "react-icons/io";
import { formatRegulatoryPercentLabel } from "@/lib/regulatory-summary";
import { formatRegulatoryPercent } from "@/lib/regulatory-calc";
import { REVENUE_BASIS_SHORT_LABELS, REVENUE_BASIS_TOOLTIPS } from "@/lib/revenue-basis";
import type { PembayaranCetakBayarFilter } from "@/lib/pembayaran-cetak";
import type {
  PelangganBayarFilter,
  PppChipBayarFilter,
} from "@/lib/pembayaran-pelanggan-bayar-filter";
import type { IsolirPelangganFilter } from "@/lib/pembayaran-isolir-filter";

type RegulatoryData = {
  grossRevenue: number;
  bhpAmount: number;
  usoAmount: number;
  totalAmount: number;
  bhpEnabled: boolean;
  usoEnabled: boolean;
  bhpPercent: number;
  usoPercent: number;
  totalPercent: number;
  calculationBasis: string;
};

type PppCounts = {
  total: number;
  belumInput: number;
  terhubung: number;
  tagihan: number;
  berhenti: number;
  gratis: number;
  belumWaktunya: number;
  tanpaTagihan: number;
  tidakTerbayar: number;
};

type Data = {
  total: number;
  belum: number;
  terbayar: number;
  tunai?: number;
  transfer?: number;
  jumlahTunai?: number;
  jumlahTransfer?: number;
  transferBank?: {
    nama: string;
    norek: string | null;
    jumlah: number;
    nominal: number;
  }[];
  komisi?: number;
  grossBagiHasil?: number;
  revenueBasis?: "INVOICE" | "PAID";
  ppn: number;
  ppnPercent?: number;
  ppnEnabled?: boolean;
  bhpUso?: number;
  pendapatan: number;
  kantor: number;
  mitra: number;
  tagihan: number;
  ownedByIsp?: boolean;
  regulatory?: RegulatoryData;
  ppp?: PppCounts;
};

type Props = {
  bulan: string;
  setBulan: React.Dispatch<React.SetStateAction<string>>;
  tahun: string | null;
  userId: number;
  staffAs?: string | null;
  filterBayar?: PembayaranCetakBayarFilter | PelangganBayarFilter;
  filterIsolir?: IsolirPelangganFilter;
  filterPenagih?: string | null;
  filterRouter?: number | null;
  refreshTrigger?: number;
  onFilterBayarChange?: (filter: PppChipBayarFilter) => void;
  collectorView?: boolean;
  hidePppCounts?: boolean;
  filterMetode?: "Cash" | "Transfer" | null;
  onFilterMetodeChange?: (metode: "Cash" | "Transfer") => void;
  filterBank?: { nama: string; norek: string | null } | null;
  onFilterBankChange?: (bank: { nama: string; norek: string | null }) => void;
};

function buildCetakHref(
  userId: number,
  bulan: string,
  opts: {
    staffAs?: string | null;
    filterBayar?: PembayaranCetakBayarFilter | PelangganBayarFilter;
    filterIsolir?: IsolirPelangganFilter;
    filterRouter?: number | null;
  }
) {
  const params = new URLSearchParams({ bulan });
  if (opts.staffAs) params.set("staff", opts.staffAs);
  if (opts.filterRouter) params.set("router", String(opts.filterRouter));
  if (
    opts.filterBayar &&
    opts.filterBayar !== "semua" &&
    (opts.filterBayar === "belum" || opts.filterBayar === "terbayar")
  ) {
    params.set("bayar", opts.filterBayar);
  }
  if (opts.filterIsolir && opts.filterIsolir !== "semua") {
    params.set("isolir", opts.filterIsolir);
  }
  return `/pembayaran/cetak/${userId}?${params.toString()}`;
}

function cetakTitle(
  filterBayar?: PembayaranCetakBayarFilter | PelangganBayarFilter,
  filterIsolir?: IsolirPelangganFilter,
  staffAs?: string | null
) {
  const parts: string[] = [];
  if (filterBayar === "belum") parts.push("belum bayar");
  else if (filterBayar === "terbayar") parts.push("sudah bayar");
  else if (filterBayar === "berhenti") parts.push("berhenti");
  else if (filterBayar === "gratis") parts.push("gratis");
  else if (filterBayar === "belum_waktunya") parts.push("belum waktunya");
  else if (filterBayar === "tanpa_tagihan") parts.push("tanpa tagihan");
  else if (filterBayar === "tidak_terbayar") parts.push("tidak terbayar");
  else if (filterBayar === "belum_input") parts.push("belum input PPP");
  else if (filterBayar === "total") parts.push("total PPPoE");
  else if (filterBayar === "tagihan") parts.push("tagihan");
  if (filterIsolir === "isolir") parts.push("isolir");
  else if (filterIsolir === "aktif") parts.push("aktif");
  if (staffAs) parts.push("staff terpilih");
  if (parts.length === 0) return "Cetak daftar belum bayar & sudah bayar";
  return `Cetak ${parts.join(", ")}`;
}

const statCardItemClass =
  "grid justify-start bg-gray-300/60 dark:bg-theme-elevated text-slate-700 dark:text-theme-fg rounded-lg overflow-hidden py-2 px-3 min-h-[4.25rem] content-start";

function formatIdr(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function formatCount(value: number) {
  return value.toLocaleString("id-ID");
}

function StatCard({
  label,
  periodLabel,
  loading,
  valueClassName,
  className,
  compact,
  count,
  countClassName,
  detail,
  onClick,
  pressed,
  children,
}: {
  label: string;
  periodLabel: string;
  loading: boolean;
  valueClassName?: string;
  className?: string;
  compact?: boolean;
  count?: number;
  countClassName?: string;
  detail?: string | null;
  onClick?: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? pressed : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        statCardItemClass,
        compact && "min-h-0 px-2 py-2.5",
        onClick && "cursor-pointer text-left",
        pressed && "ring-2 ring-slate-900 ring-offset-2 dark:ring-white",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <p
            className={cn(
              "shrink-0 font-medium leading-snug",
              compact ? "text-[11px] leading-tight" : "text-xs sm:text-sm"
            )}
          >
            {label}
          </p>
          {detail ? (
            <p className="min-w-0 truncate text-[11px] tabular-nums leading-none text-slate-500 dark:text-theme-fg-muted">
              {detail}
            </p>
          ) : null}
        </div>
        {count != null && !loading ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-1.5 py-0.5 text-slate-600 dark:bg-black/20 dark:text-theme-fg-muted",
              countClassName
            )}
          >
            <User className="size-3.5 shrink-0" aria-hidden />
            <span className="text-sm font-semibold tabular-nums leading-none">
              {formatCount(count)}
            </span>
          </div>
        ) : null}
      </div>
      {compact ? null : (
        <p className="text-[11px] mb-1 hidden md:block text-slate-500 dark:text-theme-fg-muted">
          {periodLabel}
        </p>
      )}
      {loading ? (
        <Loader2 className="animate-spin text-slate-800 dark:text-theme-fg size-5 mt-1" />
      ) : (
        <p
          className={cn(
            "font-semibold tabular-nums leading-tight mt-auto",
            compact ? "text-xs" : "text-sm sm:text-base",
            valueClassName
          )}
        >
          {children}
        </p>
      )}
    </div>
  );
}

function PppCountChip({
  label,
  value,
  valueClassName,
  loading,
  filterValue,
  activeFilter,
  onSelect,
  chipTitle,
}: {
  label: string;
  value: number;
  valueClassName?: string;
  loading: boolean;
  filterValue: PppChipBayarFilter;
  activeFilter?: PelangganBayarFilter;
  onSelect?: (filter: PppChipBayarFilter) => void;
  chipTitle?: string;
}) {
  const active = activeFilter === filterValue;
  const clickable = Boolean(onSelect);

  return (
    <button
      type="button"
      disabled={!clickable || loading}
      onClick={() => onSelect?.(filterValue)}
      title={
        chipTitle ?? (clickable ? `Filter: ${label}` : undefined)
      }
      className={cn(
        "inline-flex w-full items-center justify-between gap-1 rounded-xl bg-white px-3 py-2 text-xs leading-tight shadow-sm transition-colors dark:bg-theme-card",
        "md:w-auto md:shrink-0 md:justify-start md:rounded md:bg-slate-200/70 md:px-1.5 md:py-0.5 md:text-[11px] md:shadow-none md:dark:bg-theme-elevated",
        clickable &&
          "cursor-pointer hover:bg-slate-300/90 dark:hover:bg-theme-border/60 disabled:cursor-wait disabled:opacity-70",
        active &&
          "ring-2 ring-sky-500 ring-offset-1 ring-offset-white dark:ring-offset-theme-card bg-sky-100/90 dark:bg-sky-950/40"
      )}
    >
      <span className="min-w-0 truncate text-slate-500 dark:text-theme-fg-muted">{label}</span>
      {loading ? (
        <Loader2 className="animate-spin size-3 shrink-0 text-slate-500" />
      ) : (
        <span className={cn("shrink-0 font-semibold tabular-nums", valueClassName)}>
          {formatCount(value)}
        </span>
      )}
    </button>
  );
}

export default function Statistik({
  bulan,
  setBulan,
  tahun,
  userId,
  staffAs,
  filterBayar = "semua",
  filterIsolir = "semua",
  filterPenagih = "semua",
  filterRouter = null,
  refreshTrigger,
  onFilterBayarChange,
  collectorView = false,
  hidePppCounts = false,
  filterMetode = null,
  onFilterMetodeChange,
  filterBank = null,
  onFilterBankChange,
}: Props) {
  const [data, setData] = useState<Data>();
  const [mutating, setMutating] = useState(false);
  const [showPendapatan, setShowPendapatan] = useState(false);

  const visibleMonths = useMemo(
    () => (collectorView ? petugasVisibleMonths() : null),
    [collectorView]
  );
  const initialized = useRef<boolean>(false);
  useEffect(() => {
    if (!initialized.current) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      setBulan(`${year}-${month}`);
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (!collectorView || bulan.length === 0) return;
    const next = clampPetugasBulan(bulan);
    if (next !== bulan) setBulan(next);
  }, [bulan, collectorView, setBulan]);

  useEffect(() => {
    if (bulan.length === 0) return;

    const ac = new AbortController();
    let active = true;

    (async () => {
      setMutating(true);
      try {
        const tagihanParams = new URLSearchParams({ bulan });
        if (staffAs) tagihanParams.set("staff", staffAs);
        if (filterRouter) tagihanParams.set("router", String(filterRouter));
        // Kartu Total/Belum/Terbayar selalu agregat bulan penuh — jangan ikut filter daftar (belum/terbayar/chip PPP).
        if (filterIsolir !== "semua") tagihanParams.set("isolir", filterIsolir);
        if (filterPenagih && filterPenagih !== "semua") {
          tagihanParams.set("penagih", filterPenagih);
        }
        if (hidePppCounts) tagihanParams.set("rekap", "petugas");
        const resp = await fetch(
          `/api/pembayaran/tagihan/${userId}?${tagihanParams.toString()}`,
          { cache: "no-store", signal: ac.signal }
        );
        const json = await resp.json();
        if (!resp.ok) throw new Error(json || "Terjadi kesalahan pada server");
        if (active) setData(json.data || undefined);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const error = err as Error;
        console.error(error);
        toast.error(error.message);
      } finally {
        if (active) setMutating(false);
      }
    })();

    return () => {
      active = false;
      ac.abort();
    };
  }, [bulan, refreshTrigger, userId, staffAs, filterIsolir, filterPenagih, filterRouter, hidePppCounts]);

  const bulan_nama = useMemo(() => {
    if (bulan.length === 0) return "";
    return new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date(`${bulan}-01`));
  }, [bulan]);

  useEffect(() => {
    if (!tahun || collectorView) return;

    const loadPendapatan = async () => {
      try {
        const resp = await fetch(
          `/api/pembayaran/pendapatan/${userId}?tahun=${bulan.split("-").at(0)}`
        );
        const json = await resp.json();
        if (!resp.ok) throw new Error(json || "Terjadi kesalahan pada server");
      } catch (err) {
        const error = err as Error;
        console.error(error);
        toast.error(error.message);
      }
    };
    loadPendapatan();
  }, [tahun, bulan, userId, collectorView]);

  type LineChartState = {
    xData: string[];
    seriesTotal: number[];
    seriesBelum: number[];
    seriesTerbayar: number[];
  };
  const lineChartState = {
    xData: [],
    seriesTotal: [],
    seriesBelum: [],
    seriesTerbayar: [],
  };
  const lineChartActs = (
    state: LineChartState,
    action:
      | { action: "edit"; data: LineChartState }
      | { action: "clear" }
  ) => {
    switch (action.action) {
      case "edit":
        return { ...state, ...action.data };
      case "clear":
      default:
        return lineChartState;
    }
  };
  const [lineChart, lineChartDispatch] = useReducer(
    lineChartActs,
    lineChartState
  );

  return (
    <section className="flex flex-col self-stretch gap-3 md:gap-4">
      <div
        className={cn(
          "flex gap-3",
          collectorView
            ? "flex-col"
            : "flex-col-reverse md:flex-row md:flex-wrap md:gap-6 md:justify-between md:items-start"
        )}
      >
        <div
          className={cn(
            "grid gap-2 w-full",
            collectorView
              ? "grid-cols-3"
              : "grid-cols-2 max-md:[&>div]:rounded-2xl max-md:[&>div]:border max-md:[&>div]:border-slate-200/80 max-md:[&>div]:bg-white max-md:[&>div]:shadow-sm dark:max-md:[&>div]:border-theme-border dark:max-md:[&>div]:bg-theme-card md:flex md:flex-wrap md:gap-2 md:flex-1 md:min-w-0"
          )}
        >
          <StatCard
            label={
              collectorView
                ? "Total"
                : hidePppCounts
                  ? "Total tagihan"
                  : "Total Tagihan"
            }
            periodLabel={bulan_nama}
            loading={mutating}
            valueClassName="text-sky-700 dark:text-sky-400"
            compact={collectorView}
            className={
              collectorView
                ? "rounded-2xl border border-sky-200 bg-sky-100 text-sky-950 shadow-sm dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-100"
                : undefined
            }
          >
            {formatIdr(data?.total ?? 0)}
          </StatCard>
          <StatCard
            label={
              collectorView
                ? "Belum"
                : hidePppCounts
                  ? "Tagihan belum terbayar"
                  : "Tagihan Belum Terbayar"
            }
            periodLabel={bulan_nama}
            loading={mutating}
            valueClassName={collectorView ? "text-rose-700 dark:text-rose-300" : "text-red-500"}
            compact={collectorView}
            className={
              collectorView
                ? "rounded-2xl border border-rose-200 bg-rose-100 text-rose-950 shadow-sm dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
                : undefined
            }
          >
            {formatIdr(data?.belum ?? 0)}
          </StatCard>
          <StatCard
            label={
              collectorView
                ? "Terbayar"
                : hidePppCounts
                  ? "Tagihan terbayar"
                  : "Tagihan Terbayar"
            }
            periodLabel={bulan_nama}
            loading={mutating}
            valueClassName="text-green-600 dark:text-green-400"
            compact={collectorView}
            className={
              collectorView
                ? "rounded-2xl border border-emerald-200 bg-emerald-100 text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
                : undefined
            }
          >
            {formatIdr(data?.terbayar ?? 0)}
          </StatCard>
          {collectorView || hidePppCounts ? (
            <div className={collectorView ? "col-span-3 grid grid-cols-2 gap-2" : "contents"}>
              <StatCard
                label={collectorView ? "Total tunai" : "Tunai"}
                periodLabel={bulan_nama}
                loading={mutating}
                valueClassName="text-amber-800 dark:text-amber-200"
                compact={collectorView}
                count={collectorView ? (data?.jumlahTunai ?? 0) : undefined}
                countClassName="text-amber-800 dark:text-amber-200"
                pressed={filterMetode === "Cash"}
                onClick={() => onFilterMetodeChange?.("Cash")}
                className={
                  collectorView
                    ? "rounded-2xl border border-amber-200 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                    : undefined
                }
              >
                {formatIdr(data?.tunai ?? 0)}
              </StatCard>
              <StatCard
                label={collectorView ? "Total transfer" : "Transfer"}
                periodLabel={bulan_nama}
                loading={mutating}
                valueClassName="text-indigo-700 dark:text-indigo-300"
                compact={collectorView}
                count={collectorView ? (data?.jumlahTransfer ?? 0) : undefined}
                countClassName="text-indigo-700 dark:text-indigo-200"
                pressed={filterMetode === "Transfer" && !filterBank}
                onClick={() => onFilterMetodeChange?.("Transfer")}
                className={
                  collectorView
                    ? "rounded-2xl border border-indigo-200 bg-indigo-100 text-indigo-950 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100"
                    : undefined
                }
              >
                {formatIdr(data?.transfer ?? 0)}
              </StatCard>
              {hidePppCounts && !collectorView
                ? (data?.transferBank ?? []).map((bank) => (
                    <StatCard
                      key={`${bank.nama}-${bank.norek ?? ""}`}
                      label={bank.nama}
                      periodLabel={bulan_nama}
                      loading={mutating}
                      valueClassName="text-sky-800 dark:text-sky-300"
                      count={bank.jumlah}
                      countClassName="text-sky-800 dark:text-sky-200"
                      detail={bank.norek}
                      pressed={
                        filterBank?.nama === bank.nama &&
                        (filterBank?.norek ?? "") === (bank.norek ?? "")
                      }
                      onClick={() =>
                        onFilterBankChange?.({ nama: bank.nama, norek: bank.norek })
                      }
                    >
                      {formatIdr(bank.nominal)}
                    </StatCard>
                  ))
                : null}
              {hidePppCounts && !collectorView ? (
                <StatCard
                  label="Total komisi"
                  periodLabel={bulan_nama}
                  loading={mutating}
                  valueClassName="text-violet-700 dark:text-violet-300"
                >
                  {formatIdr(data?.komisi ?? 0)}
                </StatCard>
              ) : null}
            </div>
          ) : null}
          {collectorView ? <KomisiPetugasRingkas refreshToken={refreshTrigger} /> : null}
          {collectorView || hidePppCounts ? null : (
          <>
          {data?.ppnEnabled !== false ? (
          <StatCard
            label={`PPN (${formatRegulatoryPercent(data?.ppnPercent ?? 11)})`}
            periodLabel={bulan_nama}
            loading={mutating}
            valueClassName="text-yellow-500"
          >
            {formatIdr(data?.ppn ?? 0)}
          </StatCard>
          ) : null}

          <StatCard
            label={`BHP (${formatRegulatoryPercentLabel(data?.regulatory?.bhpEnabled ?? true, data?.regulatory?.bhpPercent ?? 0.5)})`}
            periodLabel={bulan_nama}
            loading={mutating}
            valueClassName="text-orange-600 dark:text-orange-400"
          >
            {formatIdr(data?.regulatory?.bhpAmount ?? 0)}
          </StatCard>
          <StatCard
            label={`USO (${formatRegulatoryPercentLabel(data?.regulatory?.usoEnabled ?? true, data?.regulatory?.usoPercent ?? 1.25)})`}
            periodLabel={bulan_nama}
            loading={mutating}
            valueClassName="text-orange-600 dark:text-orange-400"
          >
            {formatIdr(data?.regulatory?.usoAmount ?? 0)}
          </StatCard>

          <div className="col-span-2 md:col-span-1 flex items-center justify-center md:justify-start gap-2 py-1">
            <button
              type="button"
              className="bg-sky-900 p-2 rounded-lg shrink-0"
              onClick={() => setShowPendapatan(!showPendapatan)}
              aria-expanded={showPendapatan}
              aria-label="Tampilkan detail pendapatan"
            >
              <IoMdArrowRoundForward
                className={cn(
                  "transition text-slate-50 size-5 md:size-6",
                  "rotate-90 md:rotate-0",
                  showPendapatan && "md:rotate-180 -rotate-90"
                )}
              />
            </button>
            <span className="text-xs text-slate-600 dark:text-theme-fg-muted md:hidden">
              {showPendapatan ? "Sembunyikan detail" : "Detail pendapatan"}
            </span>
          </div>

          {showPendapatan ? (
            <>
              {data?.ownedByIsp ? (
                <StatCard
                  label={
                    data?.ppnEnabled !== false
                      ? "Total PPN, BHP, USO"
                      : "Total BHP, USO"
                  }
                  periodLabel={bulan_nama}
                  loading={mutating}
                  valueClassName="text-green-500 dark:text-green-400"
                >
                  {formatIdr(
                    (data?.ppnEnabled !== false ? (data?.ppn ?? 0) : 0) +
                      (data?.bhpUso ?? 0)
                  )}
                </StatCard>
              ) : null}
              <StatCard
                label={data?.ownedByIsp ? "Pendapatan ISP" : "Pendapatan Bersih"}
                periodLabel={bulan_nama}
                loading={mutating}
                valueClassName="text-sky-700 dark:text-sky-400"
              >
                {formatIdr(data?.pendapatan ?? 0)}
              </StatCard>
              {data?.ownedByIsp ? null : (
                <StatCard
                  label="Kantor ISP"
                  periodLabel={bulan_nama}
                  loading={mutating}
                  valueClassName="text-lime-600 dark:text-lime-400"
                >
                  {formatIdr(data?.kantor ?? 0)}
                </StatCard>
              )}
              {data?.ownedByIsp ? null : (
              <StatCard
                label="Mitra/Reseller"
                periodLabel={bulan_nama}
                loading={mutating}
                valueClassName="text-green-500 dark:text-green-400"
              >
                {formatIdr(data?.mitra ?? 0)}
              </StatCard>
              )}
              {data?.ownedByIsp ? null : (
              <div className={statCardItemClass}>
                <Tooltip title="Invoice Tagihan">
                  <button
                    type="button"
                    className="text-start w-full grid content-start"
                    onClick={() => {
                      toast.success("Stay Tune");
                    }}
                  >
                    <p className="text-xs sm:text-sm font-medium leading-snug">
                    Kewajiban Mitra ke ISP
                    </p>
                    <p className="text-[11px] mb-1 hidden md:block text-slate-500 dark:text-theme-fg-muted">
                      {bulan_nama}
                    </p>
                    {mutating ? (
                      <Loader2 className="animate-spin text-slate-800 dark:text-theme-fg size-5 mt-1" />
                    ) : (
                      <p className="font-semibold text-sm sm:text-base tabular-nums leading-tight mt-auto text-lime-500/80">
                        {formatIdr(data?.tagihan ?? 0)}
                      </p>
                    )}
                  </button>
                </Tooltip>
              </div>
              )}
            </>
          ) : null}
          </>
          )}
        </div>

        <div
          className={cn(
            "flex flex-col gap-2 w-full",
            !collectorView && "md:w-auto md:shrink-0 md:min-w-[15rem]"
          )}
        >
          {!collectorView && !hidePppCounts && data?.revenueBasis ? (
            <Tooltip title={REVENUE_BASIS_TOOLTIPS[data.revenueBasis]} arrow>
              <p className="text-[10px] text-center md:text-right text-sky-700 dark:text-sky-400 font-medium truncate cursor-default">
                {REVENUE_BASIS_SHORT_LABELS[data.revenueBasis]}
              </p>
            </Tooltip>
          ) : null}
          <p className="text-xs text-center text-slate-500 dark:text-theme-fg-muted md:hidden">
            {bulan_nama}
          </p>
          <div
            className={cn(
              "gap-2 items-center",
              collectorView
                ? "flex w-full min-w-0"
                : "grid grid-cols-1 md:flex md:gap-2"
            )}
          >
            {collectorView ? null : (
            <Link
              href={
                bulan
                  ? buildCetakHref(userId, bulan, {
                      staffAs,
                      filterBayar,
                      filterIsolir,
                      filterRouter,
                    })
                  : `#`
              }
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!bulan}
              className={`max-md:hidden p-2 h-9 rounded-lg bg-sky-900 hover:bg-sky-800 text-white md:flex items-center justify-center shrink-0 ${
                !bulan ? "pointer-events-none opacity-50" : ""
              }`}
              title={bulan ? cetakTitle(filterBayar, filterIsolir, staffAs) : "Pilih bulan terlebih dahulu"}
            >
              <Printer className="size-5 md:size-6" />
            </Link>
            )}
            <SelectMonth
              value={bulan}
              onChange={(e) =>
                setBulan(collectorView ? clampPetugasBulan(e) : e)
              }
              allowedMonths={visibleMonths ?? undefined}
              yearClassName={
                collectorView ? "min-w-0 w-full px-2 text-base" : undefined
              }
              className={cn(
                "w-full min-w-0 max-w-full gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_select:last-child]:tabular-nums",
                collectorView
                  ? "grid grid-cols-[minmax(0,1fr)_8.5rem] [&_select]:h-12 [&_select]:rounded-xl [&_select]:border [&_select]:border-sky-200 [&_select]:bg-sky-50 [&_select]:text-base [&_select]:text-sky-950 [&_select]:shadow-sm dark:[&_select]:border-sky-800 dark:[&_select]:bg-sky-950/40 dark:[&_select]:text-sky-100"
                  : "grid grid-cols-[minmax(0,1fr)_8rem] max-md:[&_select]:h-12 max-md:[&_select]:rounded-xl max-md:[&_select]:bg-white max-md:[&_select]:px-3 max-md:[&_select]:text-base max-md:[&_select]:shadow-sm md:grid-cols-[1fr_5rem] dark:max-md:[&_select]:bg-theme-card"
              )}
            />
          </div>
        </div>
      </div>

      {collectorView || hidePppCounts ? null : (
      <div className="flex flex-col gap-2 text-xs text-slate-600 dark:text-theme-fg-muted md:flex-row md:flex-wrap md:items-center md:gap-x-2 md:gap-y-1 md:text-[11px]">
        <span className="font-medium">PPPoE {bulan_nama}</span>
        <div className="grid grid-cols-2 gap-2 md:contents">
        <PppCountChip
          label="Total"
          value={data?.ppp?.total ?? 0}
          loading={mutating}
          filterValue="total"
          activeFilter={filterBayar}
          onSelect={onFilterBayarChange}
          chipTitle="Semua user PPP (sama tab Semua di halaman PPPoE). Klik untuk daftar pelanggan terhubung."
        />
        <PppCountChip
          label="Belum"
          value={data?.ppp?.belumInput ?? 0}
          valueClassName="text-violet-700 dark:text-violet-400"
          loading={mutating}
          filterValue="belum_input"
          activeFilter={filterBayar}
          onSelect={onFilterBayarChange}
          chipTitle="PPP belum punya data pelanggan (sama tab Belum di PPPoE)"
        />
        <PppCountChip
          label="Tagihan"
          value={data?.ppp?.tagihan ?? 0}
          valueClassName="text-sky-700 dark:text-sky-400"
          loading={mutating}
          filterValue="tagihan"
          activeFilter={filterBayar}
          onSelect={onFilterBayarChange}
        />
        <PppCountChip
          label="Berhenti"
          value={data?.ppp?.berhenti ?? 0}
          loading={mutating}
          filterValue="berhenti"
          activeFilter={filterBayar}
          onSelect={onFilterBayarChange}
        />
        <PppCountChip
          label="Gratis"
          value={data?.ppp?.gratis ?? 0}
          valueClassName="text-emerald-700 dark:text-emerald-400"
          loading={mutating}
          filterValue="gratis"
          activeFilter={filterBayar}
          onSelect={onFilterBayarChange}
        />
        <PppCountChip
          label="Blm waktu"
          value={data?.ppp?.belumWaktunya ?? 0}
          valueClassName="text-amber-700 dark:text-amber-400"
          loading={mutating}
          filterValue="belum_waktunya"
          activeFilter={filterBayar}
          onSelect={onFilterBayarChange}
        />
        <PppCountChip
          label="Tanpa tagihan"
          value={data?.ppp?.tanpaTagihan ?? 0}
          valueClassName="text-orange-700 dark:text-orange-400"
          loading={mutating}
          filterValue="tanpa_tagihan"
          activeFilter={filterBayar}
          onSelect={onFilterBayarChange}
        />
        <PppCountChip
          label="Tidak terbayar"
          value={data?.ppp?.tidakTerbayar ?? 0}
          valueClassName="text-red-700 dark:text-red-400"
          loading={mutating}
          filterValue="tidak_terbayar"
          activeFilter={filterBayar}
          onSelect={onFilterBayarChange}
          chipTitle="Pelanggan isolir yang tidak punya tagihan di bulan ini"
        />
        </div>
      </div>
      )}
    </section>
  );
}
