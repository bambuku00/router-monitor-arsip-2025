"use client";

import { formatIsolirOlehShort } from "@/lib/isolir-actor-label";
import { cn } from "@/lib/utils";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useEffect, useState, type ReactNode } from "react";

type RiwayatItem = {
  action: string;
  executedBy: string;
  created: string;
};

function formatWaktu(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function barisAksi(
  item: RiwayatItem,
  labelFor: (action: string) => string
): string {
  const nama = formatIsolirOlehShort(item.executedBy) ?? item.executedBy;
  return `${labelFor(item.action)} ${nama} • ${formatWaktu(item.created)}`;
}

function RiwayatList({
  pelangganId,
  href,
  labelFor,
  toneFor,
  emptyLabel,
}: {
  pelangganId: number;
  href: string;
  labelFor: (action: string) => string;
  toneFor: (action: string) => string;
  emptyLabel: string;
}) {
  const [rows, setRows] = useState<RiwayatItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setRows(null);
    setError(null);
    fetch(href, { cache: "no-store" })
      .then(async (resp) => {
        const json = await resp.json().catch(() => null);
        if (!resp.ok) {
          const message =
            json && typeof json.error === "string"
              ? json.error
              : "Gagal memuat riwayat";
          throw new Error(message);
        }
        return Array.isArray(json?.data) ? (json.data as RiwayatItem[]) : [];
      })
      .then((data) => {
        if (!cancel) setRows(data);
      })
      .catch((err: Error) => {
        if (!cancel) setError(err.message);
      });
    return () => {
      cancel = true;
    };
  }, [pelangganId, href]);

  if (error) {
    return <p className="px-1 py-2 text-xs text-red-600">{error}</p>;
  }
  if (!rows) {
    return <p className="px-1 py-2 text-xs text-slate-500">Memuat riwayat...</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="px-1 py-2 text-xs text-slate-500">{emptyLabel}</p>
    );
  }

  return (
    <ul className="max-h-64 space-y-1 overflow-y-auto">
      {rows.map((item, index) => (
        <li
          key={`${item.created}-${item.action}-${index}`}
          className={cn(
            "rounded px-2 py-1 text-[11px] leading-snug",
            toneFor(item.action)
          )}
        >
          {barisAksi(item, labelFor)}
        </li>
      ))}
    </ul>
  );
}

export default function IsolirRiwayatPopup({
  pelangganId,
  nama,
  children,
}: {
  pelangganId: number;
  nama: string;
  children: ReactNode;
}) {
  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        className="cursor-pointer appearance-none border-0 bg-transparent p-0 focus:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom"
        onClick={(event) => event.stopPropagation()}
        className="z-[1100] w-72 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg [--anchor-gap:6px] dark:border-theme-border dark:bg-theme-card"
      >
        <p className="mb-2 text-xs font-semibold text-slate-800 dark:text-theme-fg">
          Riwayat isolir {nama}
        </p>
        <RiwayatList
          pelangganId={pelangganId}
          href={`/api/pembayaran/isolir-riwayat/${pelangganId}`}
          labelFor={(action) => (action === "restore" ? "Buka" : "ISOLIR")}
          toneFor={(action) =>
            action === "restore"
              ? "bg-green-50 text-green-900"
              : "bg-red-50 text-red-900"
          }
          emptyLabel="Belum ada riwayat isolir."
        />
      </PopoverPanel>
    </Popover>
  );
}

export function BerhentiRiwayatPopup({
  pelangganId,
  nama,
  label,
}: {
  pelangganId: number;
  nama: string;
  label: string;
}) {
  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        className="whitespace-nowrap text-center text-[11px] leading-snug text-slate-600 underline decoration-dotted underline-offset-2 hover:text-sky-700 focus:outline-none dark:text-theme-fg-muted"
        onClick={(event) => event.stopPropagation()}
      >
        {label}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom"
        onClick={(event) => event.stopPropagation()}
        className="z-[1100] w-72 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg [--anchor-gap:6px] dark:border-theme-border dark:bg-theme-card"
      >
        <p className="mb-2 text-xs font-semibold text-slate-800 dark:text-theme-fg">
          Riwayat berhenti {nama}
        </p>
        <RiwayatList
          pelangganId={pelangganId}
          href={`/api/pembayaran/berhenti-riwayat/${pelangganId}`}
          labelFor={(action) => (action === "resume" ? "Aktif" : "BERHENTI")}
          toneFor={(action) =>
            action === "resume"
              ? "bg-green-50 text-green-900"
              : "bg-slate-100 text-slate-800"
          }
          emptyLabel="Belum ada riwayat berhenti."
        />
      </PopoverPanel>
    </Popover>
  );
}
