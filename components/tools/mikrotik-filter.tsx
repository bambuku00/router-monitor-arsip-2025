"use client";

import { cn } from "@/lib/utils";
import { Tab, TabGroup, TabList } from "@headlessui/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type MikrotikFilterTab = "all" | "active" | "offline" | "disabled";

const TABS = ["Semua", "Aktif", "Offline", "Disabled"] as const;

const TAB_TO_FILTER: Record<(typeof TABS)[number], MikrotikFilterTab> = {
  Semua: "all",
  Aktif: "active",
  Offline: "offline",
  Disabled: "disabled",
};

type Props = {
  filter: MikrotikFilterTab;
  setFilter: React.Dispatch<React.SetStateAction<MikrotikFilterTab>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  data: { semua: number; aktif: number; offline: number; disabled: number };
  disabled?: boolean;
};

export default function MikrotikFilter({
  filter,
  setFilter,
  setPage,
  data,
  disabled,
}: Props) {
  const handleFilter = useCallback(
    (term: MikrotikFilterTab) => {
      setFilter(term);
      setPage(1);
    },
    [setFilter, setPage]
  );

  const [tabIdx, setTabIdx] = useState(0);

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      setTabIdx(TABS.findIndex((val) => TAB_TO_FILTER[val] === filter));
      initialized.current = true;
    }
  }, [filter]);

  useEffect(() => {
    handleFilter(TAB_TO_FILTER[TABS[tabIdx]]);
  }, [tabIdx, handleFilter]);

  return (
    <div className="relative max-w-2xl w-full">
      <label htmlFor="mikrotik-filter" className="sr-only">
        Filter
      </label>
      <TabGroup selectedIndex={tabIdx} onChange={setTabIdx}>
        <TabList className="mx-auto w-full flex max-w-[44rem] space-x-0.5 rounded-md bg-gray-900/20 p-0.5">
          {TABS.map((val) => (
            <Tab
              key={val}
              className={({ selected }) =>
                cn(
                  "flex-col gap-1.5 items-center",
                  "w-full rounded py-0.5 sm:text-sm leading-5 text-slate-700 dark:text-theme-fg",
                  "text-xs",
                  selected ? "bg-white dark:bg-theme-card shadow" : "hover:bg-white/[0.12]",
                  disabled && "select-none"
                )
              }
            >
              <p>{val}</p>
              <p>
                {
                  data[
                    val === "Semua"
                      ? "semua"
                      : val === "Aktif"
                        ? "aktif"
                        : val === "Offline"
                          ? "offline"
                          : "disabled"
                  ]
                }
              </p>
            </Tab>
          ))}
        </TabList>
      </TabGroup>
    </div>
  );
}
