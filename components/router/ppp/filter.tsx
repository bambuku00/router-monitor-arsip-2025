"use client";

import { cn } from "@/lib/utils";

export type Tabs =
  | "Semua"
  | "Aktif"
  | "Nonaktif"
  | "Belum"
  | "Auto"
  | "Isolir"
  | "Berhenti";

type Data = {
  semua: number;
  aktif: number;
  nonaktif: number;
  belum: number;
  auto: number;
  isolir: number;
  berhenti: number;
};

const TABS: Tabs[] = [
  "Semua",
  "Aktif",
  "Nonaktif",
  "Belum",
  "Auto",
  "Isolir",
  "Berhenti",
];

const TAB_LABELS: Record<Tabs, string> = {
  Semua: "Semua",
  Aktif: "Aktif",
  Nonaktif: "Nonaktif",
  Belum: "Belum",
  Auto: "Auto isi",
  Isolir: "Isolir",
  Berhenti: "Berhenti",
};

type Props = {
  filter: Tabs;
  setFilter: React.Dispatch<React.SetStateAction<Tabs>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  data: Data;
  disabled?: boolean;
};

export default function FilterPPP({
  filter,
  setFilter,
  setPage,
  data,
  disabled,
}: Props) {
  return (
    <div className="relative w-full min-w-0">
      <span className="sr-only">Filter</span>
      <div
        role="tablist"
        aria-label="Filter PPP"
        className={cn(
          "grid w-full gap-0.5 rounded-md bg-gray-900/20 p-0.5",
          "grid-cols-4 sm:grid-cols-7"
        )}
      >
        {TABS.map((val) => {
          const selected = filter === val;
          return (
            <button
              key={val}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => {
                setFilter(val);
                setPage(1);
              }}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded py-1 px-0.5",
                "text-[10px] leading-tight sm:text-xs sm:leading-snug text-slate-700",
                selected ? "bg-white shadow" : "hover:bg-white/[0.12]",
                disabled && "select-none opacity-60"
              )}
            >
              <span className="w-full truncate text-center font-medium">
                {TAB_LABELS[val]}
              </span>
              <span className="tabular-nums font-semibold leading-none">
                {data[val.toLowerCase() as keyof Data]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
