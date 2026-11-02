"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import {
  masukPelangganPppoe,
  pilihPelangganPppoe,
  type MasukPelangganState,
} from "@/lib/server-actions/pelanggan-portal-actions";
import { useActionState } from "react";

const empty: MasukPelangganState = {};

export default function FormMasukPelanggan({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(masukPelangganPppoe, empty);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="slug" value={slug} />
        <label className="grid gap-2 text-base text-slate-700 dark:text-theme-fg">
          Nomor HP
          <Input
            name="nomor"
            inputMode="tel"
            autoComplete="tel"
            placeholder="08xxxxxxxxxx"
            required
            className="h-14 bg-slate-100 px-4 text-base dark:bg-theme-elevated"
          />
        </label>
        <label className="grid gap-2 text-base text-slate-700 dark:text-theme-fg">
          PIN
          <Input
            name="pin"
            type="password"
            autoComplete="off"
            placeholder="PIN dari mitra"
            required
            maxLength={32}
            className="h-14 bg-slate-100 px-4 text-base dark:bg-theme-elevated"
          />
        </label>
        {state.error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="pt-4">
          <Button
            type="submit"
            color="red"
            className="h-14 w-full justify-center bg-red-500 text-base"
            loading={pending}
          >
            Masuk
          </Button>
        </div>
      </form>

      {state.choices && state.token ? (
        <div className="grid gap-2">
          <p className="text-sm text-slate-600 dark:text-theme-fg-muted">
            Nomor ini terdaftar di lebih dari satu layanan. Pilih akun Anda.
          </p>
          {state.choices.map((row) => (
            <form key={row.id} action={pilihPelangganPppoe}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="token" value={state.token} />
              <input type="hidden" name="pelangganId" value={row.id} />
              <button
                type="submit"
                className="w-full rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card px-3 py-2 text-left hover:border-red-400"
              >
                <span className="block text-sm font-medium text-slate-800 dark:text-theme-fg">
                  {row.nama}
                </span>
                <span className="block text-xs text-slate-500">
                  {row.mitra} · No. layanan {row.noLayanan}
                </span>
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
