"use client";

import { useNavLayout } from "@/components/nav-layout-provider";
import { cn } from "@/lib/utils";
import { TbLayoutNavbar, TbLayoutSidebar } from "react-icons/tb";

type Props = {
  className?: string;
};

export default function LayoutToggle({ className }: Props) {
  const { layout, toggleLayout, mounted } = useNavLayout();
  const isSidebar = mounted && layout === "sidebar";

  return (
    <button
      type="button"
      title={isSidebar ? "Tampilan atas (header)" : "Sidebar kiri"}
      aria-label={isSidebar ? "Ganti ke tampilan header atas" : "Ganti ke sidebar kiri"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg p-1.5 md:p-2",
        "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-theme-muted",
        "focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-300 dark:focus-visible:ring-indigo-500/50",
        className
      )}
      onClick={toggleLayout}
    >
      {isSidebar ? (
        <TbLayoutNavbar className="size-5" />
      ) : (
        <TbLayoutSidebar className="size-5" />
      )}
    </button>
  );
}
