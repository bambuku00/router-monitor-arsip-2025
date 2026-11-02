"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import {
  ubahPinPelanggan,
  type UbahPinState,
} from "@/lib/server-actions/pelanggan-portal-actions";
import { useActionState } from "react";

const empty: UbahPinState = {};

export default function FormPinPelanggan({ pinSendiri }: { pinSendiri: boolean }) {
  const [state, action, pending] = useActionState(ubahPinPelanggan, empty);
  const [clearState, clearAction, clearPending] = useActionState(
    ubahPinPelanggan,
    empty
  );
  const message = state.error || clearState.error;
  const ok = state.ok || clearState.ok;

  return (
    <section className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-[#1e1e1e]">
      <div>
        <h2 className="text-sm font-semibold">PIN masuk</h2>
        <p className="mt-1 text-sm text-slate-500">
          {pinSendiri
            ? "Anda memakai PIN sendiri. Tombol di bawah mengembalikan PIN mitra."
            : "Saat ini masuk memakai PIN mitra. Isi PIN baru jika ingin PIN sendiri."}
        </p>
      </div>

      {message ? (
        <p className="text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}
      {ok ? (
        <p className="text-sm text-emerald-600" role="status">
          {ok}
        </p>
      ) : null}

      <form action={action} className="grid gap-3">
        <input type="hidden" name="mode" value="sendiri" />
        <label className="grid gap-1 text-sm">
          PIN saat ini
          <Input
            name="pinSekarang"
            type="password"
            autoComplete="off"
            maxLength={32}
            required
            className="h-12 rounded-xl bg-[#eceff1] px-4 text-base dark:bg-[#2a2a2a]"
          />
        </label>
        <label className="grid gap-1 text-sm">
          PIN baru
          <Input
            name="pinBaru"
            type="password"
            autoComplete="new-password"
            maxLength={32}
            required
            className="h-12 rounded-xl bg-[#eceff1] px-4 text-base dark:bg-[#2a2a2a]"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Ulangi PIN baru
          <Input
            name="pinUlang"
            type="password"
            autoComplete="new-password"
            maxLength={32}
            required
            className="h-12 rounded-xl bg-[#eceff1] px-4 text-base dark:bg-[#2a2a2a]"
          />
        </label>
        <Button
          type="submit"
          color="red"
          loading={pending}
          loadingMessage="Menyimpan..."
          className="h-12 w-full justify-center rounded-xl text-base"
        >
          Simpan PIN sendiri
        </Button>
      </form>

      {pinSendiri ? (
        <form action={clearAction} className="grid gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
          <input type="hidden" name="mode" value="mitra" />
          <label className="grid gap-1 text-sm">
            PIN saat ini
            <Input
              name="pinSekarang"
              type="password"
              autoComplete="off"
              maxLength={32}
              required
              className="h-12 rounded-xl bg-[#eceff1] px-4 text-base dark:bg-[#2a2a2a]"
            />
          </label>
          <Button
            type="submit"
            color="slatesky"
            loading={clearPending}
            loadingMessage="Menyimpan..."
            className="h-12 w-full justify-center rounded-xl text-base"
          >
            Pakai lagi PIN mitra
          </Button>
        </form>
      ) : null}
    </section>
  );
}
