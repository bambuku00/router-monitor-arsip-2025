"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PembukuanRouterIncome } from "@/lib/pembukuan-router";
import { getPembukuanStats } from "@/lib/server-actions/pembukuan/actions";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import CashRincian from "./cash-rincian";
import ExpenseManager from "./expense-manager";
import TransferRincian from "./transfer-rincian";

type StatsData = {
  periodRevenue: number;
  periodRevenueAll?: number;
  periodExpenses: number;
  periodKomisi?: number;
  periodUnpaid: number;
  monthlyRevenue: number[];
  dailyRevenue: number[];
  monthlyExpenses: number[];
  dailyExpenses: number[];
  paymentMethods: {
    cash: number;
    transfer: number;
  };
  thisMonth: number;
  lastMonth: number;
  thisMonthExpenses: number;
  lastMonthExpenses: number;
  recentTransactions: unknown[];
  routerIncome?: PembukuanRouterIncome[];
};

const months = [
  "Semua Bulan",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const statCardItemClass =
  "grid justify-start bg-gray-300/60 dark:bg-theme-elevated text-slate-700 dark:text-theme-fg rounded-lg overflow-hidden py-2 px-3 min-h-[4.25rem] content-start";

function StatCard({
  label,
  periodLabel,
  loading,
  valueClassName,
  children,
  onClick,
  active,
  activeClassName = "ring-2 ring-emerald-600",
}: {
  label: string;
  periodLabel: string;
  loading: boolean;
  valueClassName?: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  activeClassName?: string;
}) {
  const className = cn(statCardItemClass, onClick && "cursor-pointer", active && activeClassName);
  const body = (
    <>
      <p className="text-xs sm:text-sm font-medium leading-snug">{label}</p>
      <p className="text-[11px] mb-1 hidden md:block text-slate-500 dark:text-theme-fg-muted">
        {periodLabel}
      </p>
      {loading ? (
        <Loader2 className="animate-spin text-slate-800 dark:text-theme-fg size-5 mt-1" />
      ) : (
        <p
          className={cn(
            "font-semibold text-sm sm:text-base tabular-nums leading-tight mt-auto",
            valueClassName
          )}
        >
          {children}
        </p>
      )}
    </>
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      aria-expanded={active}
      className={className}
    >
      {body}
    </div>
  );
}

function formatIdr(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default function PembukuanDashboard({
  userId,
  title = "Pembukuan",
}: {
  userId?: number;
  title?: string;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [routerId, setRouterId] = useState<number | undefined>();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferSummary, setTransferSummary] = useState<{
    jumlah: number;
    pembayar: number;
    pelangganView: boolean;
  } | null>(null);
  const [cashTerbuka, setCashTerbuka] = useState(false);
  const [transferTerbuka, setTransferTerbuka] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const res = await getPembukuanStats(
      year,
      month === 0 ? undefined : month,
      userId,
      routerId
    );
    if (res.data) {
      setData(res.data);
    }
    setLoading(false);
  }, [year, month, userId, routerId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    setTransferSummary(null);
  }, [year, month, routerId, userId]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const periodLabel =
    month === 0 ? `Total Tahun ${year}` : `${months[month]} ${year}`;
  const routerIncome = data?.routerIncome ?? [];
  const selectedRouter = routerIncome.find((row) => row.id === routerId);
  const incomePeriodLabel = selectedRouter
    ? `${periodLabel} · ${selectedRouter.nama}`
    : periodLabel;

  const laba =
    (data?.periodRevenueAll ?? data?.periodRevenue ?? 0) -
    (data?.periodExpenses || 0);
  const penghasilanKotor = useMemo(
    () => (data?.periodRevenue || 0) + (data?.periodUnpaid || 0),
    [data]
  );

  return (
    <div className="space-y-6 pb-20 w-full">
      <section className="grid grid-cols-3 gap-4 w-full relative items-center">
        <div />
        <p className="flex justify-center font-medium">{title}</p>
        <div />
      </section>

      <section className="flex flex-col self-stretch gap-3 md:gap-4">
        <div className="flex flex-col-reverse md:flex-row md:flex-wrap gap-3 md:gap-6 md:justify-between md:items-start">
          <div className="grid grid-cols-2 gap-2 w-full md:flex md:flex-wrap md:gap-2 md:flex-1 md:min-w-0">
            <StatCard
              label="Penghasilan Kotor"
              periodLabel={incomePeriodLabel}
              loading={loading}
              valueClassName="text-sky-700 dark:text-sky-400"
            >
              {formatIdr(penghasilanKotor)}
            </StatCard>
            <StatCard
              label="Tagihan Belum Dibayar"
              periodLabel={incomePeriodLabel}
              loading={loading}
              valueClassName="text-red-500"
            >
              {formatIdr(data?.periodUnpaid || 0)}
            </StatCard>
            <StatCard
              label="Pendapatan Diterima"
              periodLabel={incomePeriodLabel}
              loading={loading}
              valueClassName="text-green-600 dark:text-green-400"
            >
              {formatIdr(data?.periodRevenue || 0)}
            </StatCard>
            {routerId ? null : (
              <>
                <StatCard
                  label="Total Pengeluaran"
                  periodLabel={periodLabel}
                  loading={loading}
                  valueClassName="text-yellow-500"
                >
                  {formatIdr(data?.periodExpenses || 0)}
                </StatCard>
                <StatCard
                  label="Komisi petugas"
                  periodLabel={periodLabel}
                  loading={loading}
                  valueClassName="text-yellow-500"
                >
                  {formatIdr(data?.periodKomisi || 0)}
                </StatCard>
              </>
            )}
            <StatCard
              label="Transfer"
              periodLabel={incomePeriodLabel}
              loading={loading}
              valueClassName="text-sky-700 dark:text-sky-400"
              onClick={() => setTransferTerbuka((buka) => !buka)}
              active={transferTerbuka}
              activeClassName="ring-2 ring-sky-600"
            >
              {formatIdr(data?.paymentMethods.transfer || 0)}
            </StatCard>
            <StatCard
              label="Rincian Transfer"
              periodLabel={incomePeriodLabel}
              loading={transferSummary === null}
              valueClassName="text-sky-700 dark:text-sky-400"
            >
              {transferSummary
                ? `${transferSummary.pembayar} ${
                    transferSummary.pelangganView ? "pelanggan" : "pembayar"
                  }`
                : "—"}
            </StatCard>
            <StatCard
              label="Cash"
              periodLabel={incomePeriodLabel}
              loading={loading}
              valueClassName="text-green-600 dark:text-green-400"
              onClick={() => setCashTerbuka((buka) => !buka)}
              active={cashTerbuka}
            >
              {formatIdr(data?.paymentMethods.cash || 0)}
            </StatCard>
            {routerId ? null : (
              <StatCard
                label="Sisa Saldo / Laba"
                periodLabel={periodLabel}
                loading={loading}
                valueClassName={
                  laba >= 0 ? "text-sky-700 dark:text-sky-400" : "text-red-500"
                }
              >
                {formatIdr(laba)}
              </StatCard>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto md:shrink-0">
            <p className="text-xs text-center text-slate-500 dark:text-theme-fg-muted md:hidden">
              {periodLabel}
            </p>
            {routerIncome.length > 0 ? (
              <select
                value={routerId ?? 0}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setRouterId(next > 0 ? next : undefined);
                }}
                className="h-9 w-full rounded-lg border-none bg-slate-200/80 dark:bg-theme-elevated dark:text-theme-fg py-1.5 px-2 sm:px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/25"
              >
                <option value={0}>Semua router</option>
                {routerIncome.map((router) => (
                  <option key={router.id} value={router.id}>
                    {router.nama}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-9 w-full rounded-lg border-none bg-slate-200/80 dark:bg-theme-elevated dark:text-theme-fg py-1.5 px-2 sm:px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/25"
              >
                {months.map((m, idx) => (
                  <option key={idx} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 w-full rounded-lg border-none bg-slate-200/80 dark:bg-theme-elevated dark:text-theme-fg py-1.5 px-2 sm:px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/25"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {cashTerbuka ? (
        <CashRincian
          year={year}
          month={month === 0 ? undefined : month}
          userId={userId}
          routerId={routerId}
        />
      ) : null}

      <TransferRincian
        year={year}
        month={month === 0 ? undefined : month}
        userId={userId}
        routerId={routerId}
        terbuka={transferTerbuka}
        onSummary={setTransferSummary}
      />

      {!loading && data ? (
        <ExpenseManager
          onUpdate={fetchDashboardData}
          year={year}
          month={month === 0 ? undefined : month}
          userId={userId}
          komisiNominal={data.periodKomisi ?? 0}
        />
      ) : null}
    </div>
  );
}
