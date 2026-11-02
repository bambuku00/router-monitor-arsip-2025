"use client";

import { LinkButton } from "@/components/button";
import Pagination from "@/components/pagination";
import { formatIsolirLogActor } from "@/lib/isolir-actor-label";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type LogRow = {
  id: number;
  created: string;
  action: string;
  status: string;
  pppUsername: string | null;
  dueDate: string | null;
  oldProfile: string | null;
  newProfile: string | null;
  errorMessage: string | null;
  executedBy: string;
  dryRun: boolean;
  pelanggan: { id: number; nama: string } | null;
  router: { id: number; nama: string } | null;
  pembayaran: { id: number; jatuh_tempo: string; total: number } | null;
};

const selectClass =
  "rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card py-2 px-3 text-sm text-slate-800 dark:text-theme-fg w-full sm:min-w-[9rem]";

const dateInputClass =
  "rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card py-2 px-3 text-sm text-slate-800 dark:text-theme-fg w-full sm:min-w-[10rem]";

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded text-xs capitalize font-medium",
        status === "success" &&
          "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300",
        status === "failed" &&
          "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300",
        status === "skipped" &&
          "bg-slate-200 dark:bg-theme-elevated text-slate-600 dark:text-theme-fg-muted"
      )}
    >
      {status}
    </span>
  );
}

function formatWaktu(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function AutoIsolirLogPage({ userId }: { userId: number }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId: String(userId),
        page: String(page),
        limit: "30",
      });
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/auto-isolir/logs?${params}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat log");
      setRows(json.data || []);
      setTotalPages(json.pagination?.totalPages ?? 1);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId, page, status, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4 w-full">
      <section className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-4 w-full items-end md:items-center">
        <div className="order-2 md:order-none w-full flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-end">
          <label className="text-sm flex flex-col gap-1.5 text-slate-700 dark:text-theme-fg flex-1 sm:flex-none">
            Status
            <select
              className={selectClass}
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">Semua</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
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
          Riwayat Auto Isolir
        </p>
        <LinkButton
          href="/isolir/settings"
          color="slatesky"
          className="order-3 md:order-none w-full md:w-min md:justify-self-end text-xs py-1.5 px-3"
        >
          Pengaturan
        </LinkButton>
      </section>

      <p className="text-sm text-slate-500 dark:text-theme-fg-muted text-center -mt-2">
        Log eksekusi isolir otomatis dan restore setelah bayar.
      </p>

      <section
        className={cn(
          "w-full overflow-x-auto rounded text-sm shadow hidden md:block"
        )}
      >
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 dark:divide-theme-border/50 bg-slate-300/70 dark:bg-theme-elevated *:px-4 *:py-2">
              <td>Waktu</td>
              <td>Pelanggan</td>
              <td>PPP</td>
              <td>Router</td>
              <td>Tagihan</td>
              <td>Aksi</td>
              <td>Oleh</td>
              <td>Profil</td>
              <td>Status</td>
              <td>Error</td>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={10}>
                  <p className="px-4 py-6 text-center text-slate-500 dark:text-theme-fg-muted">
                    <Loader2 className="animate-spin inline size-4 mr-2" />
                    Memuat...
                  </p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={10}>
                  <p className="px-4 py-6 text-center text-slate-500 dark:text-theme-fg-muted">
                    Belum ada log
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-slate-50/80 dark:bg-theme-card/30 hover:text-sky-600 dark:hover:text-sky-400 divide-x divide-y divide-slate-100 dark:divide-theme-border/40"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-xs">
                    {formatWaktu(row.created)}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    {row.pelanggan?.nama ?? "—"}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2 font-mono text-xs">
                    {row.pppUsername ?? "—"}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    {row.router?.nama ?? "—"}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2 text-xs">
                    {row.pembayaran
                      ? `${row.pembayaran.jatuh_tempo} (${row.pembayaran.total.toLocaleString("id-ID")})`
                      : row.dueDate ?? "—"}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2 capitalize">
                    {row.action}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2 text-xs">
                    {formatIsolirLogActor(row.executedBy, row.dryRun)}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2 text-xs">
                    {row.oldProfile ?? "—"} → {row.newProfile ?? "—"}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2 text-xs text-red-700 dark:text-red-400 max-w-[14rem] truncate">
                    {row.errorMessage ?? ""}
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
                <div>
                  <p className="font-semibold text-sm">
                    {row.pelanggan?.nama ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-theme-fg-muted font-mono mt-0.5">
                    {row.pppUsername ?? "—"}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500 dark:text-theme-fg-muted">Waktu</dt>
                <dd>{formatWaktu(row.created)}</dd>
                <dt className="text-slate-500 dark:text-theme-fg-muted">Router</dt>
                <dd>{row.router?.nama ?? "—"}</dd>
                <dt className="text-slate-500 dark:text-theme-fg-muted">Tagihan</dt>
                <dd>
                  {row.pembayaran
                    ? `${row.pembayaran.jatuh_tempo} (${row.pembayaran.total.toLocaleString("id-ID")})`
                    : row.dueDate ?? "—"}
                </dd>
                <dt className="text-slate-500 dark:text-theme-fg-muted">Aksi</dt>
                <dd className="capitalize">{row.action}</dd>
                <dt className="text-slate-500 dark:text-theme-fg-muted">Oleh</dt>
                <dd>{formatIsolirLogActor(row.executedBy, row.dryRun)}</dd>
                <dt className="text-slate-500 dark:text-theme-fg-muted">Profil</dt>
                <dd>
                  {row.oldProfile ?? "—"} → {row.newProfile ?? "—"}
                </dd>
                {row.errorMessage ? (
                  <>
                    <dt className="text-slate-500 dark:text-theme-fg-muted">Error</dt>
                    <dd className="text-red-700 dark:text-red-400 break-words">
                      {row.errorMessage}
                    </dd>
                  </>
                ) : null}
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
