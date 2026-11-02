"use client";

import type {
  FreeCustomerQuotaDisplayStatus,
  PppFreeCustomerQuotaStats,
} from "@/lib/ppp-page-stats";
import { formatFreeCustomerQuotaValue } from "@/lib/ppp-page-stats";
import { cn } from "@/lib/utils";
import { Tooltip } from "@mui/material";

function quotaBadgeClassName(status: FreeCustomerQuotaDisplayStatus): string {
  switch (status) {
    case "over":
      return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300";
    case "full":
      return "border-red-200 bg-red-50/80 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
    case "unlimited":
      return "border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300";
    case "ok":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-theme-border dark:bg-theme-elevated dark:text-theme-fg";
  }
}

function quotaValueClassName(status: FreeCustomerQuotaDisplayStatus): string {
  switch (status) {
    case "over":
    case "full":
      return "text-red-700 dark:text-red-300";
    case "warning":
      return "text-amber-800 dark:text-amber-300";
    case "unlimited":
      return "text-sky-700 dark:text-sky-300";
    case "ok":
    default:
      return "text-slate-800 dark:text-theme-fg";
  }
}

export default function PppFreeQuotaBadge({
  stats,
}: {
  stats: PppFreeCustomerQuotaStats;
}) {
  const display = formatFreeCustomerQuotaValue(stats);

  return (
    <Tooltip
      title="Pelanggan gratis aktif mitra (seluruh router) / batas kuota Superadmin."
      arrow
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs leading-tight",
          quotaBadgeClassName(stats.status)
        )}
        aria-label={`Kuota pelanggan gratis ${display.primary}`}
      >
        <span className="font-medium text-[11px] sm:text-xs whitespace-nowrap">
          Kuota Gratis
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums whitespace-nowrap",
            quotaValueClassName(stats.status)
          )}
        >
          {display.primary}
        </span>
        {stats.status === "over" ? (
          <span className="rounded bg-red-600 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">
            Over Limit
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}
