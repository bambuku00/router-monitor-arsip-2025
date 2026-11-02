"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/pagination";
import Search from "@/components/search";
import { getPembukuanCash } from "@/lib/server-actions/pembukuan/actions";
import type { PembukuanCashOrang } from "@/lib/pembukuan-transfer";
import type { PembukuanTransferRow } from "@/lib/pembukuan-transfer";
import { cn, formatCurrency } from "@/lib/utils";
import { TbChevronDown, TbChevronUp, TbLoader } from "react-icons/tb";

type CashData = {
  orang: PembukuanCashOrang[];
  jumlah: number;
  totalNominal: number;
  pelangganView: boolean;
  rows: PembukuanTransferRow[];
  total: number;
  page: number;
  totalPages: number;
};

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

export default function CashRincian({
  year,
  month,
  userId,
  routerId,
}: {
  year: number;
  month?: number;
  userId?: number;
  routerId?: number;
}) {
  const [data, setData] = useState<CashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [pelaku, setPelaku] = useState<string | null>(null);
  const [sortDiproses, setSortDiproses] = useState<"tanggal" | null>(null);
  const scopeKey = `${year}|${month ?? ""}|${userId ?? ""}|${routerId ?? ""}`;
  const [scopeSnap, setScopeSnap] = useState(scopeKey);
  if (scopeSnap !== scopeKey) {
    setScopeSnap(scopeKey);
    setPelaku(null);
    setQuery("");
    setSortDiproses(null);
  }
  const filtersKey = `${scopeKey}|${pelaku ?? ""}|${query}|${pageSize}|${sortDiproses ?? ""}`;
  const [filterSnap, setFilterSnap] = useState(filtersKey);
  if (filterSnap !== filtersKey) {
    setFilterSnap(filtersKey);
    setPage(1);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await getPembukuanCash({
      year,
      month,
      mitraId: userId,
      routerId,
      page,
      pageSize,
      query,
      pelaku: pelaku ?? undefined,
      sort: sortDiproses,
    });
    if ("data" in res && res.data) {
      setError(null);
      setData(res.data);
    } else {
      setData(null);
      setError("error" in res && res.error ? res.error : "Gagal memuat pembayaran cash");
    }
    setLoading(false);
  }, [year, month, userId, routerId, page, pageSize, query, pelaku, sortDiproses]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const choosePelaku = (nama: string) => {
    setPelaku((current) => (current === nama ? null : nama));
    setQuery("");
  };

  const urutTanggalTerbaru = sortDiproses === "tanggal";
  const ArrowDiproses = urutTanggalTerbaru ? TbChevronUp : TbChevronDown;
  const showPppoe = data?.pelangganView !== false;
  const nameLabel = data?.pelangganView === false ? "Mitra" : "Pelanggan";
  const columnCount = showPppoe ? 6 : 5;
  const totalPages = data?.totalPages ?? 1;

  return (
    <section className="flex w-full flex-col gap-3">
      <p className="text-sm font-medium">Pembayaran cash</p>
      {data && data.orang.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.orang.map((orang) => {
            const active = pelaku === orang.nama;
            return (
              <button
                key={orang.nama}
                type="button"
                onClick={() => choosePelaku(orang.nama)}
                className={cn(
                  "rounded-lg bg-gray-300/60 px-3 py-2 text-left dark:bg-theme-elevated",
                  active && "ring-2 ring-emerald-600"
                )}
              >
                <p className="text-xs font-medium leading-snug">{orang.nama}</p>
                <p className="text-[11px] text-slate-500 dark:text-theme-fg-muted">
                  {orang.jumlah} pembayaran
                </p>
                <p className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">
                  {formatCurrency(orang.total)}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="min-w-[12rem] flex-1">
        <Search
          isSearchParams={false}
          queryState={query}
          handleSearch={setQuery}
          placeholder={
            showPppoe ? "Cari pelanggan, PPPoE, atau pemroses" : "Cari nama"
          }
        />
      </div>

      <div className="hidden w-full overflow-x-auto rounded text-sm shadow md:block">
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2 dark:divide-theme-border/50">
              <td>No.</td>
              <td>Periode</td>
              <td>{nameLabel}</td>
              {showPppoe ? <td>PPPoE</td> : null}
              <td className={cn("!p-0", urutTanggalTerbaru && "bg-emerald-600")}>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-full w-full cursor-pointer appearance-none items-center justify-center gap-1 border-0 px-4 py-2 font-inherit focus:outline-none",
                    urutTanggalTerbaru
                      ? "bg-emerald-600 text-white"
                      : "bg-transparent text-inherit hover:text-emerald-700"
                  )}
                  disabled={loading}
                  aria-pressed={urutTanggalTerbaru}
                  onClick={() =>
                    setSortDiproses((current) => (current === "tanggal" ? null : "tanggal"))
                  }
                >
                  Diproses oleh
                  <ArrowDiproses className="size-3.5 shrink-0" aria-hidden />
                </button>
              </td>
              <td className="text-right">Nominal</td>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={columnCount}>
                  <p className="px-4 py-2 text-center">
                    <TbLoader className="mr-2 inline animate-spin" />
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
                        ? "Tidak ada pembayaran cash yang cocok"
                        : "Tidak ada pembayaran cash pada periode ini"}
                  </p>
                </td>
              </tr>
            ) : (
              data.rows.map((row, idx) => {
                const nomor = (data.page - 1) * pageSize + idx + 1;
                return (
                  <tr
                    key={row.id}
                    className="divide-x divide-y divide-slate-100 bg-slate-50/80 dark:divide-theme-border/40 dark:bg-theme-card/30"
                  >
                    <td className="px-4 py-2">{nomor}.</td>
                    <td className="px-4 py-2">{formatPeriode(row.periode)}</td>
                    <td className="px-4 py-2">{row.nama}</td>
                    {showPppoe ? <td className="px-4 py-2">{row.pppoe}</td> : null}
                    <td className="px-4 py-2">
                      <div className="flex flex-col leading-snug">
                        <span>{row.pemroses}</span>
                        {row.diprosesPada ? (
                          <span className="text-[11px] tabular-nums text-slate-500 dark:text-theme-fg-muted">
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

      <div className="flex w-full flex-col gap-3 md:hidden">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm">
            <TbLoader className="mr-2 inline animate-spin" />
            Memuat...
          </p>
        ) : !data || data.rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm dark:border-theme-border">
            {error
              ? error
              : data && data.jumlah > 0
                ? "Tidak ada pembayaran cash yang cocok"
                : "Tidak ada pembayaran cash pada periode ini"}
          </p>
        ) : (
          data.rows.map((row, idx) => {
            const nomor = (data.page - 1) * pageSize + idx + 1;
            return (
              <div
                key={row.id}
                className="flex w-full flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-theme-border dark:bg-theme-card"
              >
                <div className="flex justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">
                    <span className="mr-1 text-sm text-slate-500">{nomor}.</span>
                    {row.nama}
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(row.nominal)}
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                  {showPppoe ? `${row.pppoe} · ` : ""}
                  {formatPeriode(row.periode)}
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

      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-theme-fg-muted">
          <span>Tampilkan</span>
          <select
            className="cursor-pointer rounded-lg border-none bg-slate-200/80 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/25 dark:bg-theme-elevated"
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
    </section>
  );
}
