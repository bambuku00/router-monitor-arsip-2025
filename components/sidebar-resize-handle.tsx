"use client";

import { cn } from "@/lib/utils";
import { useCallback, useRef } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

const DRAG_THRESHOLD_PX = 48;

type Props = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onToggle: () => void;
};

export default function SidebarResizeHandle({
  collapsed,
  onCollapsedChange,
  onToggle,
}: Props) {
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, moved: false };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      if (Math.abs(delta) > 4) dragRef.current.moved = true;
      if (delta <= -DRAG_THRESHOLD_PX) onCollapsedChange(true);
      if (delta >= DRAG_THRESHOLD_PX) onCollapsedChange(false);
    },
    [onCollapsedChange]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current) return;
      if (!dragRef.current.moved) onToggle();
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [onToggle]
  );

  return (
    <button
      type="button"
      title={
        collapsed
          ? "Klik atau geser kanan (>) untuk buka menu"
          : "Klik atau geser kiri (<) untuk tutup ke icon saja"
      }
      aria-label={collapsed ? "Buka sidebar penuh" : "Ciutkan sidebar ke icon"}
      className={cn(
        "absolute top-3 -right-3 z-30 touch-none",
        "flex size-6 items-center justify-center rounded-full cursor-pointer",
        "border border-slate-200 dark:border-theme-border",
        "bg-white dark:bg-theme-card shadow-md",
        "text-slate-600 dark:text-slate-300",
        "hover:bg-red-600 hover:text-white hover:border-red-600",
        "dark:hover:bg-red-600 dark:hover:text-white dark:hover:border-red-600",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:focus-visible:ring-red-500/50",
        "transition-colors duration-150"
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {collapsed ? (
        <FaChevronRight className="size-2.5 shrink-0" aria-hidden />
      ) : (
        <FaChevronLeft className="size-2.5 shrink-0" aria-hidden />
      )}
    </button>
  );
}
