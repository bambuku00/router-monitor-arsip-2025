"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type ForbiddenActionsProps = {
  allowedRoute: string | null;
};

export default function ForbiddenActions({ allowedRoute }: ForbiddenActionsProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logoutHandler = useCallback(async () => {
    setLoggingOut(true);
    try {
      const resp = await fetch("/api/auth/logout", { method: "POST" });
      if (resp.ok) {
        router.push("/login");
        router.refresh();
      }
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-3">
      {allowedRoute ? (
        <Link
          href={allowedRoute}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Kembali ke halaman yang diizinkan
        </Link>
      ) : (
        <p className="max-w-md text-sm text-slate-500">
          Akun ini belum memiliki akses ke halaman manapun. Hubungi Admin untuk
          mengatur izin menu.
        </p>
      )}
      <button
        type="button"
        onClick={() => void logoutHandler()}
        disabled={loggingOut}
        className="text-sm font-medium text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
      >
        {loggingOut ? "Keluar…" : "Keluar dari akun"}
      </button>
    </div>
  );
}
