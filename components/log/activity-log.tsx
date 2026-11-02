"use client";

import Pagination from "@/components/pagination";
import { ACTIVITY_LOG_FILTERS } from "@/lib/audit-log-label";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type LogRow = {
  id: string;
  created: string;
  actionLabel: string;
  outcome: string;
  outcomeLabel: string;
  pelaku: string;
  ip: string;
  keterangan: string;
};

const selectClass =
  "rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card py-2 px-3 text-sm text-slate-800 dark:text-theme-fg w-full sm:min-w-[12rem]";

const dateInputClass =
  "rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card py-2 px-3 text-sm text-slate-800 dark:text-theme-fg w-full sm:min-w-[10rem]";

function OutcomeBadge({ outcome, label }: { outcome: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded text-xs font-medium",
        outcome === "success" &&
          "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300",
        (outcome === "failed" || outcome === "denied") &&
          "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300",
        outcome === "rate_limited" &&
          "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300",
        outcome === "dry_run" &&
          "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300",
        outcome === "skipped" &&
          "bg-slate-200 dark:bg-theme-muted text-slate-700 dark:text-theme-fg"
      )}
    >
      {label}
    </span>
  );
}

function formatWaktu(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function ActivityLogPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "30",
      });
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/audit-log?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat log");
      setRows(json.data || []);
      setTotalPages(json.pagination?.totalPages ?? 1);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, action, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4 w-full">
      <section className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-4 w-full items-end md:items-center">
        <div className="order-2 md:order-none w-full flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-end">
          <label className="text-sm flex flex-col gap-1.5 text-slate-700 dark:text-theme-fg flex-1 sm:flex-none">
            Aktivitas
            <select
              className={selectClass}
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
            >
              <option value="">Semua</option>
              {ACTIVITY_LOG_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1.5 text-slate-700 dark:text-theme-fg flex-1 sm:flex-none">
            Dari
            <input
              type="date"
              className={dateInputClass}
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="text-sm flex flex-col gap-1.5 text-slate-700 dark:text-theme-fg flex-1 sm:flex-none">
            Sampai
            <input
              type="date"
              className={dateInputClass}
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
            />
          </label>
        </div>
        <p className="flex justify-center font-medium items-center order-1 md:order-none">
          Log Aktivitas
        </p>
        <div className="order-3 md:order-none hidden md:block" />
      </section>

      <p className="text-sm text-slate-500 dark:text-theme-fg-muted text-center -mt-2">
        Login, logout, isolir, pembayaran, pembatalan, berhenti, lanjut
        berlangganan, ganti paket, pelanggan baru, registrasi yang ditolak,
        kuota pelanggan gratis, dan auto isi.
      </p>

      <section className="w-full overflow-x-auto rounded text-sm shadow hidden md:block">
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 dark:divide-theme-border/50 bg-slate-300/70 dark:bg-theme-elevated *:px-4 *:py-2">
              <td>Waktu</td>
              <td>Aktivitas</td>
              <td>Hasil</td>
              <td>Pelaku</td>
              <td>IP</td>
              <td>Keterangan</td>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={6}>
                  <p className="px-4 py-6 text-center text-slate-500 dark:text-theme-fg-muted">
                    <Loader2 className="animate-spin inline size-4 mr-2" />
                    Memuat...
                  </p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={6}>
                  <p className="px-4 py-6 text-center text-slate-500 dark:text-theme-fg-muted">
                    Belum ada log
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-slate-50/80 dark:bg-theme-card/30 divide-x divide-y divide-slate-100 dark:divide-theme-border/40"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-xs">
                    {formatWaktu(row.created)}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    {row.actionLabel}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <OutcomeBadge outcome={row.outcome} label={row.outcomeLabel} />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">{row.pelaku}</td>
                  <td className="whitespace-pre-wrap px-4 py-2 font-mono text-xs">
                    {row.ip}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2 text-xs max-w-[18rem]">
                    {row.keterangan}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3 md:hidden w-full">
        {loading ? (
          <div className="bg-slate-50 dark:bg-theme-card rounded-lg p-8 text-center text-slate-500 dark:text-theme-fg-muted border border-slate-200 dark:border-theme-border border-dashed">
            <Loader2 className="animate-spin inline size-5 mr-2" />
            Memuat...
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-slate-50 dark:bg-theme-card rounded-lg p-8 text-center text-slate-500 dark:text-theme-fg-muted border border-slate-200 dark:border-theme-border border-dashed">
            Belum ada log
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="w-full bg-white dark:bg-theme-card rounded-lg shadow-sm border border-slate-200 dark:border-theme-border p-3 flex flex-col gap-2"
            >
              <div className="flex justify-between items-start gap-2 border-b border-slate-100 dark:border-theme-border pb-2">
                <p className="font-semibold text-sm">{row.actionLabel}</p>
                <OutcomeBadge outcome={row.outcome} label={row.outcomeLabel} />
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500 dark:text-theme-fg-muted">Waktu</dt>
                <dd>{formatWaktu(row.created)}</dd>
                <dt className="text-slate-500 dark:text-theme-fg-muted">Pelaku</dt>
                <dd>{row.pelaku}</dd>
                <dt className="text-slate-500 dark:text-theme-fg-muted">IP</dt>
                <dd className="font-mono">{row.ip}</dd>
                <dt className="text-slate-500 dark:text-theme-fg-muted">Keterangan</dt>
                <dd className="break-words">{row.keterangan}</dd>
              </dl>
            </div>
          ))
        )}
      </section>

      <Pagination
        isSearchParams={false}
        pageState={page}
        totalPagesState={totalPages}
        onChange={setPage}
      />
    </div>
  );
}
