"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/pagination";
import Search from "@/components/search";
import { getPembukuanTransfers } from "@/lib/server-actions/pembukuan/actions";
import type {
  PembukuanTransferBank,
  PembukuanTransferRow,
  TransferDiprosesSort,
} from "@/lib/pembukuan-transfer";
import { cn, formatCurrency } from "@/lib/utils";
import { TbChevronDown, TbChevronUp, TbLoader } from "react-icons/tb";

type TransferData = {
  banks: PembukuanTransferBank[];
  jumlah: number;
  pembayar: number;
  pelangganView: boolean;
  rows: PembukuanTransferRow[];
  total: number;
  page: number;
  totalPages: number;
};

function bankFilterParts(label: string): { name: string; norek: string | null } {
  const splitAt = label.indexOf(" · ");
  if (splitAt < 0) return { name: label, norek: null };
  return { name: label.slice(0, splitAt), norek: label.slice(splitAt + 3) };
}

function formatPeriode(value: string) {
  const parts = value.split("-");
  if (parts.length >= 3) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  }
  if (parts.length >= 2) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    }
  }
  return value;
}

export default function TransferRincian({
  year,
  month,
  userId,
  routerId,
  terbuka = false,
  onSummary,
}: {
  year: number;
  month?: number;
  userId?: number;
  routerId?: number;
  terbuka?: boolean;
  onSummary?: (summary: {
    jumlah: number;
    pembayar: number;
    pelangganView: boolean;
  }) => void;
}) {
  const [data, setData] = useState<TransferData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [sortDiproses, setSortDiproses] = useState<TransferDiprosesSort | null>(null);
  const scopeKey = `${year}|${month ?? ""}|${userId ?? ""}|${routerId ?? ""}`;
  const [scopeSnap, setScopeSnap] = useState(scopeKey);
  if (scopeSnap !== scopeKey) {
    setScopeSnap(scopeKey);
    setSelectedBank(null);
    setQuery("");
    setSortDiproses(null);
  }
  const [terbukaSnap, setTerbukaSnap] = useState(terbuka);
  if (terbukaSnap !== terbuka) {
    setTerbukaSnap(terbuka);
    if (!terbuka) {
      setSelectedBank(null);
      setQuery("");
      setSortDiproses(null);
    }
  }
  const filtersKey = `${scopeKey}|${selectedBank ?? ""}|${query}|${pageSize}|${sortDiproses ?? ""}`;
  const [filterSnap, setFilterSnap] = useState(filtersKey);
  if (filterSnap !== filtersKey) {
    setFilterSnap(filtersKey);
    setPage(1);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await getPembukuanTransfers({
      year,
      month,
      mitraId: userId,
      routerId,
      page,
      pageSize,
      query,
      bank: selectedBank ?? undefined,
      sort: sortDiproses,
    });
    if ("data" in res && res.data) {
      setError(null);
      setData(res.data);
      onSummary?.({
        jumlah: res.data.jumlah,
        pembayar: res.data.pembayar,
        pelangganView: res.data.pelangganView,
      });
    } else {
      setData(null);
      onSummary?.({ jumlah: 0, pembayar: 0, pelangganView: true });
      setError(
        "error" in res && res.error ? res.error : "Gagal memuat rincian transfer"
      );
    }
    setLoading(false);
  }, [
    year,
    month,
    userId,
    routerId,
    page,
    pageSize,
    query,
    selectedBank,
    sortDiproses,
    onSummary,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useCallback((val: string) => {
    setQuery(val);
  }, []);

  const chooseBank = (bank: string) => {
    if (selectedBank?.toLowerCase() === bank.toLowerCase()) {
      setSelectedBank(null);
      setQuery("");
      return;
    }
    setSelectedBank(bank);
    setQuery("");
  };

  const urutTanggalTerbaru = sortDiproses === "tanggal";
  const ArrowDiproses = urutTanggalTerbaru ? TbChevronUp : TbChevronDown;
  const diprosesOlehButton = (fill: "cell" | "chip") => (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1 appearance-none border-0 font-inherit focus:outline-none",
        fill === "cell" ? "h-full w-full px-4 py-2" : "rounded px-2 py-1",
        urutTanggalTerbaru
          ? "bg-sky-600 text-white dark:bg-sky-700"
          : "bg-transparent text-inherit hover:text-sky-700 dark:hover:text-sky-300"
      )}
      disabled={loading}
      title={
        urutTanggalTerbaru
          ? "Urutan tanggal terbaru aktif. Klik lagi untuk urutan semula"
          : "Urutkan tanggal terbaru di atas"
      }
      aria-pressed={urutTanggalTerbaru}
      onClick={() =>
        setSortDiproses((current) => (current === "tanggal" ? null : "tanggal"))
      }
    >
      Diproses oleh
      <ArrowDiproses className="size-3.5 shrink-0" aria-hidden />
    </button>
  );

  const totalPages = data?.totalPages ?? 1;
  const showPppoe = data?.pelangganView !== false;
  const nameLabel = data?.pelangganView === false ? "Mitra" : "Pelanggan";
  const columnCount = showPppoe ? 7 : 6;

  if (!terbuka) return null;

  return (
    <section className="flex flex-col gap-3 w-full">
      {data && data.banks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {data.banks.map((bank) => {
            const active = selectedBank?.toLowerCase() === bank.bank.toLowerCase();
            const parts = bankFilterParts(bank.bank);
            return (
              <button
                key={bank.bank}
                type="button"
                onClick={() => chooseBank(bank.bank)}
                className={cn(
                  "rounded-lg bg-gray-300/60 dark:bg-theme-elevated text-left px-3 py-2",
                  active && "ring-2 ring-sky-500"
                )}
              >
                <p className="text-xs font-medium leading-snug">{parts.name}</p>
                {parts.norek ? (
                  <p className="text-[11px] font-mono leading-snug text-slate-600 dark:text-theme-fg">
                    {parts.norek}
                  </p>
                ) : null}
                <p className="text-[11px] text-slate-500 dark:text-theme-fg-muted">
                  {bank.jumlah} transfer
                </p>
                <p className="font-semibold text-sm tabular-nums text-sky-700 dark:text-sky-400">
                  {formatCurrency(bank.total)}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedBank ? (
      <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem] flex-1">
          <Search
            isSearchParams={false}
            queryState={query}
            handleSearch={handleSearch}
            placeholder={
              showPppoe ? "Cari pelanggan, PPPoE, atau bank" : "Cari nama atau bank"
            }
          />
        </div>
        <div className="inline-flex md:hidden items-center text-sm text-slate-700 dark:text-theme-fg">
          {diprosesOlehButton("chip")}
        </div>
      </div>
      <div className="w-full overflow-x-auto rounded text-sm shadow hidden md:block">
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 dark:divide-theme-border/50 bg-slate-300/70 *:px-4 *:py-2">
              <td>No.</td>
              <td>Periode</td>
              <td>{nameLabel}</td>
              {showPppoe ? <td>PPPoE</td> : null}
              <td>Bank</td>
              <td
                className={cn(
                  "!p-0",
                  urutTanggalTerbaru && "bg-sky-600 dark:bg-sky-700"
                )}
              >
                {diprosesOlehButton("cell")}
              </td>
              <td className="text-right">Nominal</td>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={columnCount}>
                  <p className="px-4 py-2 text-center">
                    <TbLoader className="animate-spin inline mr-2" />
                    Memuat...
                  </p>
                </td>
              </tr>
            ) : !data || data.rows.length === 0 ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={columnCount}>
                  <p className="px-4 py-2 text-center">
                    {error
                      ? error
                      : data && data.jumlah > 0
                        ? "Tidak ada transfer yang cocok"
                        : "Tidak ada transfer pada periode ini"}
                  </p>
                </td>
              </tr>
            ) : (
              data.rows.map((row, idx) => {
                const nomor = (data.page - 1) * pageSize + idx + 1;
                return (
                  <tr
                    key={row.id}
                    className="bg-slate-50/80 dark:bg-theme-card/30 divide-x divide-y divide-slate-100 dark:divide-theme-border/40"
                  >
                    <td className="px-4 py-2">{nomor}.</td>
                    <td className="px-4 py-2">{formatPeriode(row.periode)}</td>
                    <td className="px-4 py-2">{row.nama}</td>
                    {showPppoe ? <td className="px-4 py-2">{row.pppoe}</td> : null}
                    <td className="px-4 py-2 font-medium">{row.bank}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col leading-snug">
                        <span>{row.pemroses}</span>
                        {row.diprosesPada ? (
                          <span className="text-[11px] text-slate-500 tabular-nums dark:text-theme-fg-muted">
                            {row.diprosesPada}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(row.nominal)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden w-full">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm">
            <TbLoader className="animate-spin inline mr-2" />
            Memuat...
          </p>
        ) : !data || data.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm rounded-lg border border-dashed border-slate-200 dark:border-theme-border">
            {error
              ? error
              : data && data.jumlah > 0
                ? "Tidak ada transfer yang cocok"
                : "Tidak ada transfer pada periode ini"}
          </p>
        ) : (
          data.rows.map((row, idx) => {
            const nomor = (data.page - 1) * pageSize + idx + 1;
            return (
              <div
                key={row.id}
                className="w-full bg-white dark:bg-theme-card rounded-lg shadow-sm border border-slate-200 dark:border-theme-border p-3 flex flex-col gap-1"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-medium min-w-0 truncate">
                    <span className="text-slate-500 text-sm mr-1">{nomor}.</span>
                    {row.nama}
                  </p>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {formatCurrency(row.nominal)}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                  {showPppoe ? `${row.pppoe} · ` : ""}
                  {row.bank} · {formatPeriode(row.periode)}
                </p>
                <p className="text-xs text-slate-600 dark:text-theme-fg">
                  Diproses: {row.pemroses}
                  {row.diprosesPada ? ` · ${row.diprosesPada}` : ""}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-theme-fg-muted">
          <span>Tampilkan</span>
          <select
            className="bg-slate-200/80 dark:bg-theme-elevated border-none rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>data</span>
        </div>
        <Pagination
          isSearchParams={false}
          pageState={page}
          totalPagesState={totalPages}
          onChange={(val) => setPage(val)}
        />
      </div>
      </div>
      ) : null}
    </section>
  );
}
