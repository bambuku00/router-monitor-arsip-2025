"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import {
  buatPortalTiket,
  type BuatTiketState,
} from "@/lib/server-actions/portal-tiket-actions";
import {
  PORTAL_TIKET_KATEGORI_LABEL,
  PORTAL_TIKET_PRIORITAS,
  PORTAL_TIKET_PRIORITAS_LABEL,
  PORTAL_TIKET_STATUS_LABEL,
  portalTiketWaDefault,
  type PortalTiketItem,
} from "@/lib/portal-tiket";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

const empty: BuatTiketState = {};

export default function PanelTiket({
  tiket,
  nomorTerdaftar,
}: {
  tiket: PortalTiketItem[];
  nomorTerdaftar: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(buatPortalTiket, empty);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-4">
      <form
        key={state.ok ?? "form"}
        action={action}
        className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-[#1e1e1e]"
      >
        <div>
          <h2 className="text-sm font-semibold">Buat tiket</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sampaikan keluhan atau keperluan lain. Mitra akan membalas di sini.
          </p>
        </div>
        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="text-sm text-emerald-600" role="status">
            {state.ok}
          </p>
        ) : null}
        <label className="grid gap-1 text-sm">
          Jenis
          <select
            name="kategori"
            required
            defaultValue="keluhan"
            className="h-12 rounded-xl bg-[#eceff1] px-4 text-base dark:bg-[#2a2a2a]"
          >
            <option value="keluhan">Keluhan</option>
            <option value="lainnya">Lainnya</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Nomor WhatsApp
          <Input
            name="wa"
            required
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            defaultValue={portalTiketWaDefault(nomorTerdaftar)}
            placeholder="08xxxxxxxxxx"
            className="h-12 rounded-xl bg-[#eceff1] px-4 text-base dark:bg-[#2a2a2a]"
          />
          <span className="text-xs text-slate-500">
            Terisi dari nomor terdaftar. Ubah jika ingin dihubungi di nomor lain.
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          Prioritas
          <select
            name="prioritas"
            required
            defaultValue="normal"
            className="h-12 rounded-xl bg-[#eceff1] px-4 text-base dark:bg-[#2a2a2a]"
          >
            {PORTAL_TIKET_PRIORITAS.map((item) => (
              <option key={item} value={item}>
                {PORTAL_TIKET_PRIORITAS_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Judul
          <Input
            name="judul"
            required
            minLength={3}
            maxLength={120}
            placeholder="Contoh: Internet sering putus"
            className="h-12 rounded-xl bg-[#eceff1] px-4 text-base dark:bg-[#2a2a2a]"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Pesan
          <textarea
            name="pesan"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            placeholder="Jelaskan keluhan atau keperluan Anda."
            className="rounded-xl bg-[#eceff1] px-4 py-3 text-base dark:bg-[#2a2a2a]"
          />
        </label>
        <Button type="submit" color="red" disabled={pending} className="h-12 rounded-xl">
          {pending ? "Mengirim…" : "Kirim tiket"}
        </Button>
      </form>

      <section className="grid gap-3">
        {tiket.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm dark:bg-[#1e1e1e]">
            Belum ada tiket.
          </p>
        ) : (
          tiket.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#1e1e1e]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {PORTAL_TIKET_KATEGORI_LABEL[item.kategori]}
                    {" · "}
                    {PORTAL_TIKET_PRIORITAS_LABEL[item.prioritas]}
                  </p>
                  <h3 className="mt-1 text-base font-medium">{item.judul}</h3>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}
                >
                  {PORTAL_TIKET_STATUS_LABEL[item.status]}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatWaktu(item.created)}
                {item.wa ? ` · WhatsApp ${item.wa}` : ""}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{item.pesan}</p>
              {item.balasan ? (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Balasan admin
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{item.balasan}</p>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function statusClass(status: PortalTiketItem["status"]): string {
  if (status === "selesai") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (status === "diproses") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
}

function formatWaktu(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
