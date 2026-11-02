"use client";

import { Button } from "@/components/button";
import {
  balasPortalTiket,
  hapusPortalTiket,
  type BalasTiketState,
  type HapusTiketState,
} from "@/lib/server-actions/portal-tiket-actions";
import {
  PORTAL_TIKET_KATEGORI_LABEL,
  PORTAL_TIKET_PRIORITAS_LABEL,
  PORTAL_TIKET_STATUS,
  PORTAL_TIKET_STATUS_LABEL,
  type StaffPortalTiketItem,
} from "@/lib/portal-tiket";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { TbEdit, TbTrash } from "react-icons/tb";

const emptyBalas: BalasTiketState = {};
const emptyHapus: HapusTiketState = {};

export default function DaftarTiket({ tiket }: { tiket: StaffPortalTiketItem[] }) {
  const [tangani, setTangani] = useState<StaffPortalTiketItem | null>(null);
  const [hapus, setHapus] = useState<StaffPortalTiketItem | null>(null);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <section className="grid w-full grid-cols-3 gap-4">
        <div />
        <p className="flex items-center justify-center font-medium">Tiket Pelanggan</p>
        <div />
      </section>
      <p className="text-center text-sm text-slate-500 dark:text-theme-fg-muted">
        Keluhan dan permintaan yang dikirim dari Portal Pelanggan.
      </p>

      <section className="hidden w-full overflow-x-auto rounded text-sm shadow md:block">
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2 dark:divide-theme-border/50 dark:bg-theme-elevated">
              <td>No.</td>
              <td>Waktu</td>
              <td>Pelanggan</td>
              <td>No. Layanan</td>
              <td>Jenis</td>
              <td>Prioritas</td>
              <td>Judul</td>
              <td>Status</td>
              <td>Diproses oleh</td>
              <td className="text-center">*</td>
            </tr>
          </thead>
          <tbody>
            {tiket.length === 0 ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={10}>
                  <p className="px-4 py-6 text-center text-slate-500">Belum ada tiket.</p>
                </td>
              </tr>
            ) : (
              tiket.map((item, idx) => (
                <tr
                  key={item.id}
                  className="divide-x divide-y divide-slate-100 bg-slate-50/80 hover:text-sky-600 dark:divide-theme-border/40 dark:bg-theme-card/30 dark:hover:text-sky-400"
                >
                  <td className="whitespace-nowrap px-4 py-2">{idx + 1}.</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs">{formatWaktu(item.created)}</td>
                  <td className="px-4 py-2">{item.pelangganNama}</td>
                  <td className="whitespace-nowrap px-4 py-2">{item.noLayanan || "—"}</td>
                  <td className="px-4 py-2">{PORTAL_TIKET_KATEGORI_LABEL[item.kategori]}</td>
                  <td className="px-4 py-2">{PORTAL_TIKET_PRIORITAS_LABEL[item.prioritas]}</td>
                  <td className="max-w-[16rem] px-4 py-2">{item.judul}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-2">{item.diprosesOleh || "—"}</td>
                  <td className="px-4 py-2">
                    <Aksi item={item} onTangani={setTangani} onHapus={setHapus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="flex w-full flex-col gap-3 md:hidden">
        {tiket.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-theme-border dark:bg-theme-card">
            Belum ada tiket.
          </p>
        ) : (
          tiket.map((item, idx) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-theme-border dark:bg-theme-card"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 dark:border-white/10">
                <div>
                  <p className="flex items-center gap-2 text-base font-bold">
                    <span className="text-sm text-slate-500">{idx + 1}.</span>
                    {item.judul}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.pelangganNama}
                    {item.noLayanan ? ` · ${item.noLayanan}` : ""}
                  </p>
                </div>
                <Aksi item={item} onTangani={setTangani} onHapus={setHapus} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>{formatWaktu(item.created)}</span>
                <span>{PORTAL_TIKET_KATEGORI_LABEL[item.kategori]}</span>
                <span>{PORTAL_TIKET_PRIORITAS_LABEL[item.prioritas]}</span>
                <StatusBadge status={item.status} />
                {item.diprosesOleh ? <span>Diproses oleh {item.diprosesOleh}</span> : null}
              </div>
            </div>
          ))
        )}
      </section>

      <DialogTangani item={tangani} onClose={() => setTangani(null)} />
      <DialogHapus item={hapus} onClose={() => setHapus(null)} />
    </div>
  );
}

function Aksi({
  item,
  onTangani,
  onHapus,
}: {
  item: StaffPortalTiketItem;
  onTangani: (item: StaffPortalTiketItem) => void;
  onHapus: (item: StaffPortalTiketItem) => void;
}) {
  return (
    <div className="flex justify-center gap-2">
      {item.waUrl ? (
        <a
          href={item.waUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Hubungi WhatsApp"
          aria-label="Hubungi WhatsApp"
          className="inline-flex items-center rounded bg-slate-200 px-2 py-1 text-[#25D366] hover:text-[#25D366] dark:bg-theme-elevated"
        >
          <FaWhatsapp className="size-4" />
        </a>
      ) : null}
      <Button
        type="button"
        color="slatesky"
        className="rounded"
        title="Tangani"
        onClick={() => onTangani(item)}
      >
        <TbEdit className="size-4" />
      </Button>
      {item.status === "selesai" ? (
        <Button
          type="button"
          color="slatesky"
          className="rounded"
          title="Hapus"
          onClick={() => onHapus(item)}
        >
          <TbTrash className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

function DialogTangani({
  item,
  onClose,
}: {
  item: StaffPortalTiketItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(balasPortalTiket, emptyBalas);

  useEffect(() => {
    if (item && state.tiketId === item.id && state.ok) {
      onClose();
      router.refresh();
    }
  }, [item, state.ok, state.tiketId, onClose, router]);

  return (
    <Dialog open={item != null} onClose={onClose} className="relative z-[1001]">
      <DialogBackdrop className="fixed inset-0 bg-black/25" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-2xl bg-white p-6 text-left text-slate-900 shadow-xl dark:bg-theme-card dark:text-theme-fg">
            {item ? (
              <>
                <DialogTitle className="text-base font-medium">Tangani tiket</DialogTitle>
                <p className="mt-1 text-sm text-slate-500">
                  {item.pelangganNama}
                  {item.noLayanan ? ` · ${item.noLayanan}` : ""}
                  {item.wa ? ` · ${item.wa}` : ""}
                </p>
                <p className="mt-3 text-sm font-medium">{item.judul}</p>
                {item.diprosesOleh ? (
                  <p className="mt-1 text-sm text-slate-500">Diproses oleh {item.diprosesOleh}</p>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{item.pesan}</p>
                {item.waUrl ? (
                  <a
                    href={item.waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-300"
                  >
                    Hubungi WhatsApp
                  </a>
                ) : null}
                <form action={action} className="mt-4 grid gap-3">
                  <input type="hidden" name="tiketId" value={item.id} />
                  <label className="grid gap-1 text-sm">
                    Status
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-theme-border dark:bg-theme-bg"
                    >
                      {PORTAL_TIKET_STATUS.map((status) => (
                        <option key={status} value={status}>
                          {PORTAL_TIKET_STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Balasan untuk pelanggan
                    <textarea
                      name="balasan"
                      defaultValue={item.balasan ?? ""}
                      maxLength={2000}
                      rows={4}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-theme-border dark:bg-theme-bg"
                    />
                  </label>
                  {state.tiketId === item.id && state.error ? (
                    <p className="text-sm text-red-600" role="alert">
                      {state.error}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-1">
                    <Button type="submit" color="red" disabled={pending}>
                      {pending ? "Menyimpan…" : "Simpan"}
                    </Button>
                    <Button type="button" color="red100" onClick={onClose}>
                      Batal
                    </Button>
                  </div>
                </form>
              </>
            ) : null}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function DialogHapus({
  item,
  onClose,
}: {
  item: StaffPortalTiketItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(hapusPortalTiket, emptyHapus);

  useEffect(() => {
    if (item && state.tiketId === item.id && state.ok) {
      onClose();
      router.refresh();
    }
  }, [item, state.ok, state.tiketId, onClose, router]);

  return (
    <Dialog open={item != null} onClose={onClose} className="relative z-[1001]">
      <DialogBackdrop className="fixed inset-0 bg-black/25" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-2xl bg-white p-6 text-left text-slate-900 shadow-xl dark:bg-theme-card dark:text-theme-fg">
            <DialogTitle className="text-base font-medium">Hapus tiket</DialogTitle>
            <p className="mt-2 text-sm">
              Tiket selesai akan dihapus dan tidak dapat dikembalikan.
            </p>
            {item && state.tiketId === item.id && state.error ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {state.error}
              </p>
            ) : null}
            {item ? (
              <form action={action} className="mt-4 flex items-center justify-end gap-1">
                <input type="hidden" name="tiketId" value={item.id} />
                <Button type="submit" color="red" disabled={pending}>
                  {pending ? "Menghapus…" : "Hapus"}
                </Button>
                <Button type="button" color="red100" onClick={onClose}>
                  Batal
                </Button>
              </form>
            ) : null}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: StaffPortalTiketItem["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-2 py-0.5 text-xs font-medium",
        status === "selesai" && "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
        status === "diproses" && "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
        status === "baru" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
      )}
    >
      {PORTAL_TIKET_STATUS_LABEL[status]}
    </span>
  );
}

function formatWaktu(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
