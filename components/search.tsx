"use client";

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { Input } from "@headlessui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { GrSearch } from "react-icons/gr";

type BaseProps = {
  isSearchParams?: boolean;
  disabled?: boolean;
  queryState?: string;
  handleSearch?: (val: string) => void;
  placeholder?: string;
  appearance?: "default" | "app" | "adaptive";
};

type ConditionalProps<T extends boolean | undefined> = T extends false
  ? {
      isSearchParams: T;
      disabled?: boolean;
      queryState: string;
      handleSearch: (val: string) => void;
      placeholder?: string;
      appearance?: "default" | "app" | "adaptive";
    }
  : BaseProps;

export default function Search<T extends boolean | undefined>({
  isSearchParams = true,
  disabled,
  queryState,
  handleSearch,
  placeholder,
  appearance = "default",
}: ConditionalProps<T>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParams = isSearchParams
    ? searchParams.get("query") || ""
    : queryState || "";
  const [q, setQ] = useState(queryParams);
  const queryDefer = useDeferredValue(q);
  const [_, startTransition] = useTransition();
  const pendingEchoes = useRef<string[]>([]);

  const handleQuery = useCallback(
    (term: string) => {
      if (isSearchParams) {
        const params = new URLSearchParams(window.location.search);
        if (term) {
          params.set("query", term);
          params.set("page", "1");
        } else {
          params.delete("query");
        }

        startTransition(() => {
          window.history.replaceState(
            null,
            "",
            `${pathname}?${params.toString()}`
          );
        });

        const updatedSearchParams = new URLSearchParams(params.toString());
        updatedSearchParams.set("query", term);
      } else if (handleSearch) {
        handleSearch(term);
      }
    },
    [pathname, startTransition, isSearchParams, handleSearch]
  );

  useEffect(() => {
    pendingEchoes.current.push(queryDefer);
    handleQuery(queryDefer);
  }, [queryDefer, handleQuery]);

  useEffect(() => {
    const incoming = queryParams || "";
    const queue = pendingEchoes.current;
    const idx = queue.indexOf(incoming);
    if (idx !== -1) {
      pendingEchoes.current = queue.slice(idx + 1);
      return;
    }
    setQ((current) => (current === incoming ? current : incoming));
  }, [queryParams]);

  return (
    <div
      className={
        appearance === "app"
          ? "relative flex w-full flex-1"
          : appearance === "adaptive"
            ? "relative flex w-full flex-1 md:max-w-sm md:gap-2"
            : "relative max-w-sm flex flex-1 gap-2"
      }
    >
      <label htmlFor="search" className="sr-only">
        Cari
      </label>
      <div className="flex-1">
        <div
          className={
            appearance === "app"
              ? "pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 pl-3"
              : appearance === "adaptive"
                ? "pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 pl-3 md:pl-2"
                : "pointer-events-none hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 pl-2"
          }
          aria-hidden="true"
        >
          <GrSearch className="mr-3 size-4 text-gray-400 dark:text-theme-fg-muted" aria-hidden="true" />
        </div>
        <Input
          type="text"
          name="search"
          id="search"
          disabled={disabled}
          className={
            appearance === "app"
              ? "h-12 w-full rounded-xl border border-sky-200 bg-sky-50 pl-10 pr-3 text-base text-sky-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
              : appearance === "adaptive"
                ? "block w-full focus:outline-none h-12 rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base text-slate-900 shadow-sm focus:ring-2 focus:ring-sky-300 dark:border-theme-border dark:bg-theme-card dark:text-theme-fg md:h-8 md:rounded-none md:border-x-0 md:border-t-0 md:border-b-[3px] md:border-slate-600/90 md:bg-transparent md:py-0 md:pr-2 md:pl-8 md:text-sm md:shadow-none md:focus:ring-0 dark:md:border-theme-border dark:md:bg-transparent dark:md:text-theme-fg"
                : "h-8 block w-full text-sm rounded-none border-b sm:border-b-[3px] border-slate-600/90 dark:border-theme-border dark:text-theme-fg dark:bg-transparent sm:pl-8 px-2 focus:outline-none"
          }
          placeholder={placeholder || "Cari"}
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
    </div>
  );
}
