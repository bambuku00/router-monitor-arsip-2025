"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { TbMoon, TbSun } from "react-icons/tb";

type Props = {
  className?: string;
  showLabel?: boolean;
};

export default function ThemeToggle({ className, showLabel = false }: Props) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className={cn("inline-block size-9 shrink-0", className)} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setTheme(isDark ? "light" : "dark");
      }}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition",
        "hover:bg-slate-50 hover:text-slate-900",
        "focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-300",
        "dark:border-theme-border dark:bg-theme-elevated dark:text-theme-fg dark:hover:bg-theme-muted dark:hover:text-white",
        className
      )}
    >
      {isDark ? <TbSun className="size-4" /> : <TbMoon className="size-4" />}
      {showLabel ? (
        <span className="text-xs font-medium">{isDark ? "Terang" : "Gelap"}</span>
      ) : null}
    </button>
  );
}
