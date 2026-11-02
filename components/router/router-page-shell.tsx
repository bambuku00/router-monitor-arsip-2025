import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Wrapper halaman router — pola sama dengan /routers dan /paket. */
export default function RouterPageShell({ children }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg w-full">
      {children}
    </div>
  );
}
