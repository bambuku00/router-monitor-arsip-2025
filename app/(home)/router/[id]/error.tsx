"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RouterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("router_page_error", error.message);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-theme-fg">
        Gagal memuat halaman router
      </h1>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
        Terjadi kesalahan saat memuat data. Silakan coba lagi atau kembali ke
        daftar router.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Coba lagi
        </button>
        <Link
          href="/routers"
          className="text-sm font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300"
        >
          Ke daftar router
        </Link>
      </div>
    </div>
  );
}
