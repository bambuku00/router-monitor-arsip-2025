"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { VariantProps, cva } from "class-variance-authority";
import { VscLoading } from "react-icons/vsc";

type ButtonProps = {
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  color?: string;
  loading?: boolean;
  loadingMessage?: string;
} & React.ComponentProps<"button"> &
  VariantProps<typeof colorButtonVariant>;

const colorButtonVariant = cva("", {
  variants: {
    color: {
      amber:
        "bg-amber-500 enabled:hover:bg-amber-600 enabled:active:bg-amber-700",
      amber100:
        "bg-amber-100 text-amber-500 enabled:hover:bg-amber-200 enabled:active:bg-amber-300",
      cyan: "bg-cyan-500 enabled:hover:bg-cyan-600 enabled:active:bg-cyan-700",
      cyan100:
        "bg-cyan-100 text-cyan-500 enabled:hover:bg-cyan-200 enabled:active:bg-cyan-300",
      green:
        "bg-green-500 enabled:hover:bg-green-600 enabled:active:bg-green-700",
      green100:
        "bg-green-100 text-green-500 enabled:hover:bg-green-200 enabled:active:bg-green-300",
      red: "bg-red-500 enabled:hover:bg-red-600 enabled:active:bg-red-700",
      red100:
        "bg-red-100 text-red-500 enabled:hover:bg-red-200 enabled:active:bg-red-300",
      sky: "bg-sky-500 enabled:hover:bg-sky-600 enabled:active:bg-sky-700",
      sky700: "bg-sky-700 enabled:hover:bg-sky-800 disabled:bg-sky-900",
      slatesky:
        "rounded-full bg-slate-200 dark:bg-theme-elevated font-semibold text-sky-600 dark:text-sky-400 enabled:active:bg-slate-300 dark:enabled:active:bg-theme-muted",
    },
  },
  defaultVariants: { color: "sky700" },
});

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      disabled,
      className = "",
      type,
      color,
      loading,
      loadingMessage = "Processing...",
      ...props
    },
    ref
  ) => {
    return (
      <button
        {...props}
        type={type || "button"}
        className={cn(
          "inline-flex items-center rounded px-2 py-1 text-center text-sm font-medium text-white focus:outline-none focus:ring-0 disabled:opacity-50",
          loading ? "disabled:cursor-progress" : "disabled:cursor-not-allowed",
          colorButtonVariant({ color }),
          className
        )}
        ref={ref}
        disabled={loading || disabled ? true : false}
      >
        {loading ? (
          <>
            <span>
              <VscLoading className="mr-1.5 inline h-4 w-4 animate-spin" />
            </span>
            <span>{loadingMessage}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

type ButtonTransparentProps = {
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  color?: string;
  loading?: boolean;
  loadingMessage?: string;
} & React.ComponentProps<"button"> &
  VariantProps<typeof colorButtonTransparentVariant>;

const colorButtonTransparentVariant = cva("", {
  variants: {
    color: {
      amber:
        "border border-amber-500 bg-transparent text-amber-500 enabled:active:bg-amber-100 disabled:bg-amber-100",
      cyan: "border border-cyan-500 bg-transparent text-cyan-500 enabled:active:bg-cyan-100 disabled:bg-cyan-100",
      green:
        "border border-green-500 bg-transparent text-green-500 enabled:active:bg-green-100 disabled:bg-green-100",
      red: "border border-red-500 bg-transparent text-red-500 enabled:active:bg-red-100 disabled:bg-red-100",
      sky: "border border-sky-500 bg-transparent text-sky-500 enabled:active:bg-sky-100 disabled:bg-sky-100",
    },
  },
  defaultVariants: { color: "sky" },
});

const ButtonTransparent = React.forwardRef<
  HTMLButtonElement,
  ButtonTransparentProps
>(
  (
    {
      children,
      disabled,
      className = "",
      color,
      type,
      loading,
      loadingMessage = "Processing...",
      ...props
    },
    ref
  ) => {
    return (
      <button
        {...props}
        type={type || "button"}
        className={cn(
          "inline-flex items-center rounded-lg px-2 py-1 text-center text-sm font-medium focus:outline-none disabled:opacity-50",
          loading ? "disabled:cursor-progress" : "disabled:cursor-not-allowed",
          colorButtonTransparentVariant({ color }),
          className
        )}
        ref={ref}
        disabled={loading || disabled ? true : false}
      >
        {loading ? (
          <>
            <span>
              <VscLoading className="mr-1.5 inline h-4 w-4 animate-spin" />
            </span>
            <span>{loadingMessage}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
ButtonTransparent.displayName = "ButtonTransparent";

type AnchorProps = {
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  color?: string;
} & React.ComponentProps<"a"> &
  VariantProps<typeof colorButtonVariant>;

/**
 * Resolves the exact className `LinkButton` renders for a given `color`/`className`.
 * Extracted so other components (e.g. `next/link`'s `Link`) can reproduce the identical
 * LinkButton visual styling without duplicating the base class string or the color variant
 * mapping. Keep this in sync with the `<a>` rendered below — it is the single source of truth.
 */
function linkButtonClassName({
  color,
  className = "",
}: VariantProps<typeof colorButtonVariant> & { className?: string }) {
  return cn(
    "inline-flex items-center rounded-lg px-2 py-1 text-center text-sm font-medium focus:outline-none disabled:opacity-50",
    colorButtonVariant({ color }),
    className
  );
}

const LinkButton = React.forwardRef<HTMLAnchorElement, AnchorProps>(
  ({ children, disabled, className = "", type, color, ...props }, ref) => {
    return (
      <a
        {...props}
        type={type || "button"}
        className={linkButtonClassName({ color, className })}
        ref={ref}
      >
        {children}
      </a>
    );
  }
);
LinkButton.displayName = "LinkButton";

export { Button, ButtonTransparent, LinkButton, linkButtonClassName };
