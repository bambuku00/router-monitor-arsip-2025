"use client";

import { PembayaranHarianPoint } from "@/lib/server-actions/dashboard/actions";
import { formatCurrency } from "@/lib/utils";
import { LineChart } from "@mui/x-charts";
import { useMemo } from "react";
import { TbChartAreaLine } from "react-icons/tb";

type Props = {
  data: PembayaranHarianPoint[];
  bulanLabel: string;
};

const COLOR_TERBAYAR = "#22c55e";
const COLOR_BELUM = "#f59e0b";

export default function PembayaranBulanChart({ data, bulanLabel }: Props) {
  const labels = useMemo(() => data.map((d) => d.label), [data]);
  const terbayarSeries = useMemo(() => data.map((d) => d.terbayar), [data]);
  const belumSeries = useMemo(() => data.map((d) => d.belum), [data]);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        terbayar: acc.terbayar + row.terbayar,
        belum: acc.belum + row.belum,
        countTerbayar: acc.countTerbayar + row.countTerbayar,
        countBelum: acc.countBelum + row.countBelum,
      }),
      { terbayar: 0, belum: 0, countTerbayar: 0, countBelum: 0 }
    );
  }, [data]);

  const yMax = useMemo(() => {
    const peak = Math.max(...data.map((d) => d.total), 0);
    if (peak <= 0) return 100000;
    const mag = Math.pow(10, Math.floor(Math.log10(peak)));
    return Math.ceil(peak / mag) * mag;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Tidak ada data pembayaran
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200/80 dark:border-theme-border shadow-sm">
      <div className="flex items-center justify-between gap-2 bg-slate-700 dark:bg-slate-800 text-white px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <TbChartAreaLine className="size-4 shrink-0 opacity-90" />
          <p className="text-sm font-medium truncate">Pembayaran {bulanLabel}</p>
        </div>
        <p className="text-[11px] text-slate-300 shrink-0 hidden sm:block">
          per tanggal jatuh tempo
        </p>
      </div>

      <div className="bg-white dark:bg-theme-card px-2 pt-3 pb-2">
        <LineChart
          height={300}
          margin={{ top: 12, right: 16, bottom: 8, left: 56 }}
          xAxis={[
            {
              data: labels,
              scaleType: "point",
              tickLabelStyle: { fontSize: 10 },
              tickInterval: (_value, index) => index % 5 === 0,
            },
          ]}
          yAxis={[
            {
              min: 0,
              max: yMax,
              tickLabelStyle: { fontSize: 10 },
              valueFormatter: (v) => {
                if (v == null || v === 0) return "0";
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
                if (v >= 1_000) return `${Math.round(v / 1_000)}rb`;
                return String(Math.round(v));
              },
            },
          ]}
          series={[
            {
              data: terbayarSeries,
              label: "Terbayar",
              color: COLOR_TERBAYAR,
              area: true,
              stack: "tagihan",
              showMark: false,
              valueFormatter: (v) => formatCurrency(v ?? 0),
            },
            {
              data: belumSeries,
              label: "Belum",
              color: COLOR_BELUM,
              area: true,
              stack: "tagihan",
              showMark: false,
              valueFormatter: (v) => formatCurrency(v ?? 0),
            },
          ]}
          grid={{ horizontal: true }}
          slotProps={{
            legend: { hidden: true },
          }}
        />

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-3 pt-2 pb-1 border-t border-slate-100 dark:border-theme-border text-xs">
          <LegendItem
            color={COLOR_TERBAYAR}
            label="Terbayar"
            value={formatCurrency(totals.terbayar)}
            count={totals.countTerbayar}
          />
          <LegendItem
            color={COLOR_BELUM}
            label="Belum"
            value={formatCurrency(totals.belum)}
            count={totals.countBelum}
          />
        </div>
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  value,
  count,
}: {
  color: string;
  label: string;
  value: string;
  count: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
      <span
        className="size-2.5 rounded-sm shrink-0"
        style={{ backgroundColor: color }}
      />
      <span>
        {label}{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          ({count})
        </span>
      </span>
      <span className="text-slate-400 dark:text-slate-500">·</span>
      <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
}
