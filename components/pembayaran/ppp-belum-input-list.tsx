"use client";

import { Button } from "@/components/button";
import type { PppBelumInputRow } from "@/lib/pembayaran-ppp-counts";
import Link from "next/link";

type Props = {
  rows: PppBelumInputRow[];
  page: number;
  pageLimit: number;
};

export default function PppBelumInputList({ rows, page, pageLimit }: Props) {
  return (
    <>
      <section className="md:hidden space-y-3">
        {rows.map((row, idx) => {
          const nomor = (page - 1) * pageLimit + idx + 1;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-violet-200 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">#{nomor}</p>
                  <p className="font-semibold text-slate-800 dark:text-theme-fg">
                    {row.name}
                  </p>
                  <p className="text-xs text-slate-500">{row.router.nama}</p>
                </div>
                <span
                  className={
                    row.on_router
                      ? "text-[10px] font-medium text-green-700"
                      : "text-[10px] font-medium text-slate-500"
                  }
                >
                  {row.on_router ? "Online" : "Offline"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-theme-fg-muted">
                Profil: {row.profile || "—"}
              </p>
              <Link href={`/router/${row.router.id}/ppp`} className="block">
                <Button type="button" color="sky" className="w-full text-sm">
                  Isi data di PPPoE
                </Button>
              </Link>
            </div>
          );
        })}
      </section>

      <section className="hidden md:block w-full overflow-x-auto rounded text-sm shadow">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="divide-x divide-slate-50 dark:divide-theme-border/50 bg-slate-300/70 *:px-4 *:py-2">
              <td>No.</td>
              <td>Router</td>
              <td>PPP</td>
              <td>Profil</td>
              <td className="text-center">Status</td>
              <td className="text-center min-w-[8rem]">Aksi</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const nomor = (page - 1) * pageLimit + idx + 1;
              return (
                <tr
                  key={row.id}
                  className="bg-slate-50/80 dark:bg-theme-card/30 divide-x divide-y divide-slate-100 dark:divide-theme-border/40"
                >
                  <td className="px-4 py-2">{nomor}.</td>
                  <td className="px-4 py-2">{row.router.nama}</td>
                  <td className="px-4 py-2 font-medium">{row.name}</td>
                  <td className="px-4 py-2">{row.profile || "—"}</td>
                  <td className="px-4 py-2 text-center text-xs">
                    {row.on_router ? (
                      <span className="text-green-700 font-medium">Online</span>
                    ) : (
                      <span className="text-slate-500">Offline</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Link href={`/router/${row.router.id}/ppp`}>
                      <Button type="button" color="sky" className="text-xs py-1">
                        Isi data PPPoE
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
