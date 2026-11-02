"use client";

import { cn } from "@/lib/utils";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";

type PaginationProps = {
  isSearchParams?: boolean;
  onChange?: (newPage: number) => void;
  pageState?: number;
  totalPagesState?: number;
};

type ConditionalProps<T extends boolean | undefined> = T extends false
  ? {
      isSearchParams: T;
      onChange: (newPage: number) => void;
      pageState: number;
      totalPagesState: number;
    }
  : PaginationProps;

export default function Pagination<T extends boolean | undefined>({
  isSearchParams = true,
  onChange,
  pageState,
  totalPagesState,
}: ConditionalProps<T>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = isSearchParams
    ? parseInt(searchParams.get("page") || "1")
    : pageState || 1;
  const totalPages = isSearchParams
    ? parseInt(searchParams.get("totalPages") || "1")
    : totalPagesState || 1;

  const setPage = (newPage: number) => {
    if (isSearchParams) {
      const params = new URLSearchParams(searchParams);
      params.set("page", newPage.toString());
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    } else if (onChange) {
      onChange(newPage);
    }
  };

  const style =
    "relative mr-1 inline-flex items-center rounded-md bg-gray-50 dark:bg-theme-elevated px-3 py-1 text-sm font-medium dark:text-theme-fg";
  const oddStyles = {
    listItem: "text-gray-500 dark:text-theme-fg-muted hover:bg-gray-50 dark:hover:bg-theme-muted",
    listItemActive: "cursor-default bg-gray-600 dark:bg-indigo-500 text-white",
    listDisable: "cursor-default font-bold bg-transparent text-gray-500 dark:text-theme-fg-muted",
  };

  return (
    <div className="flex w-full max-w-full items-center justify-start md:inline-flex md:w-auto">
      <div className="isolate flex w-full max-w-full flex-wrap gap-y-1 rounded-md md:inline-flex md:w-auto md:flex-nowrap md:gap-y-0">
        {totalPages > 1 && page > 1 ? (
          <button
            disabled={page < 2}
            type="button"
            className={cn(style)}
            onClick={() => setPage(page - 1)}
          >
            <RiArrowLeftSLine className="inline text-gray-500" size="1rem" />
          </button>
        ) : null}
        {totalPages > 1 ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(
              style,
              page === 1 ? oddStyles.listItemActive : oddStyles.listItem
            )}
            onClick={() => setPage(1)}
          >
            1
          </button>
        ) : null}
        {page > 3 ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(style, oddStyles.listDisable)}
          >
            ...
          </button>
        ) : null}
        {page > 2 ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(style, oddStyles.listItem)}
            onClick={() => setPage(page - 1)}
          >
            {page - 1}
          </button>
        ) : null}
        {page > 1 ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(style, oddStyles.listItemActive)}
            onClick={() => setPage(page)}
          >
            {page}
          </button>
        ) : null}
        {page < totalPages - 1 ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(style, oddStyles.listItem)}
            onClick={() => setPage(page + 1)}
          >
            {page + 1}
          </button>
        ) : null}
        {page < totalPages - 2 ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(style, oddStyles.listItem)}
            onClick={() => setPage(page + 2)}
          >
            {page + 2}
          </button>
        ) : null}
        {page < totalPages - 3 ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(style, oddStyles.listDisable)}
          >
            ...
          </button>
        ) : null}
        {page < totalPages ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(
              style,
              page === totalPages
                ? oddStyles.listItemActive
                : oddStyles.listItem
            )}
            onClick={() => setPage(totalPages)}
          >
            {totalPages}
          </button>
        ) : null}
        {page < totalPages ? (
          <button
            // disabled={mutating}
            type="button"
            className={cn(style, oddStyles.listItem)}
            onClick={() => setPage(page + 1)}
          >
            <RiArrowRightSLine className="inline text-gray-500" size="1rem" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
