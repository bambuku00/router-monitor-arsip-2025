"use client";

import { SelectMonth } from "@/components/input";
import type { RekapMetodeBaris } from "@/lib/penagih-rekap-metode";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Loader2, Printer } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";

type Props = {
  show: boolean;
  setShow: (open: boolean) => void;
  mitraId: number | null;
  penagih: { id: number; nama: string } | null;
};

function formatIdr(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(bulan: string) {
  if (!/^\d{4}-\d{2}$/.test(bulan)) return bulan;
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${bulan}-01`));
}

const th =
  "border border-slate-200 bg-slate-300/90 px-3 py-2 text-xs sm:text-sm font-medium text-left";
const td = "border border-slate-100 px-3 py-2 text-sm tabular-nums";

export default function DialogRekapMetode({
  show,
  setShow,
  mitraId,
  penagih,
}: Props) {
  const [bulan, setBulan] = useState(currentMonth);
  const [rows, setRows] = useState<RekapMetodeBaris[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show || !mitraId || !penagih) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      bulan,
      mitraId: String(mitraId),
      penagihId: String(penagih.id),
    });
    void fetch(`/api/penagih/rekap-metode?${params.toString()}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          data?: RekapMetodeBaris[];
          error?: string;
        } | null;
        if (!res.ok) throw new Error(json?.error || "Gagal memuat rincian");
        if (!ac.signal.aborted) setRows(json?.data ?? []);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError" || ac.signal.aborted) return;
        setRows([]);
        setError(err.message);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [show, mitraId, penagih, bulan]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          jumlahBelum: acc.jumlahBelum + row.jumlahBelum,
          nominalBelum: acc.nominalBelum + row.nominalBelum,
          jumlahSudah: acc.jumlahSudah + row.jumlahSudah,
          nominalSudah: acc.nominalSudah + row.nominalSudah,
          jumlahTunai: acc.jumlahTunai + row.jumlahTunai,
          nominalTunai: acc.nominalTunai + row.nominalTunai,
          jumlahTransfer: acc.jumlahTransfer + row.jumlahTransfer,
          nominalTransfer: acc.nominalTransfer + row.nominalTransfer,
        }),
        {
          jumlahBelum: 0,
          nominalBelum: 0,
          jumlahSudah: 0,
          nominalSudah: 0,
          jumlahTunai: 0,
          nominalTunai: 0,
          jumlahTransfer: 0,
          nominalTransfer: 0,
        }
      ),
    [rows]
  );
  const totalDitagih = totals.nominalBelum + totals.nominalSudah;

  return (
    <Transition show={show} as={Fragment}>
      <Dialog as="div" className="relative z-[1001]" onClose={() => setShow(false)}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </TransitionChild>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="flex max-h-[min(92vh,820px)] w-[calc(100vw-2rem)] max-w-7xl transform flex-col overflow-hidden rounded-2xl bg-white text-left text-gray-900 shadow-xl transition-all">
                <DialogTitle
                  as="div"
                  className="shrink-0 space-y-4 border-b border-slate-200 px-6 py-5"
                >
                  <div>
                    <p className="text-lg font-semibold">
                      {penagih?.nama ?? "Petugas"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Tagihan pelanggan petugas ini pada {monthLabel(bulan)}, dihitung per paket
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SelectMonth
                      value={bulan}
                      onChange={setBulan}
                      aria-label="Bulan rincian"
                      className="grid w-full max-w-md shrink-0 grid-cols-[minmax(0,1fr)_7rem] gap-3 [&_select]:h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:px-3"
                    />
                    {mitraId && penagih ? (
                      <a
                        href={`/petugas/cetak/rekap?${new URLSearchParams({
                          bulan,
                          mitraId: String(mitraId),
                          penagihId: String(penagih.id),
                        }).toString()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white"
                      >
                        <Printer className="size-4" />
                        Cetak berkas
                      </a>
                    ) : null}
                  </div>
                </DialogTitle>
                <div className="flex-1 overflow-auto px-6 py-5">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
                      <Loader2 className="size-6 animate-spin" />
                      <span>Memuat rincian…</span>
                    </div>
                  ) : error ? (
                    <p className="py-10 text-center text-sm text-red-600">{error}</p>
                  ) : rows.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">
                      Belum ada tagihan untuk petugas ini pada {monthLabel(bulan)}.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs font-medium text-slate-500">Total ditagih</p>
                          <p className="mt-1 text-lg font-semibold tabular-nums">
                            {formatIdr(totalDitagih)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {totals.jumlahBelum + totals.jumlahSudah} tagihan
                          </p>
                        </div>
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                          <p className="text-xs font-medium text-rose-700">Belum bayar</p>
                          <p className="mt-1 text-lg font-semibold tabular-nums text-rose-800">
                            {formatIdr(totals.nominalBelum)}
                          </p>
                          <p className="mt-0.5 text-xs text-rose-700">
                            {totals.jumlahBelum} tagihan
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-xs font-medium text-emerald-700">Sudah bayar</p>
                          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-800">
                            {formatIdr(totals.nominalSudah)}
                          </p>
                          <p className="mt-0.5 text-xs text-emerald-700">
                            {totals.jumlahSudah} tagihan
                          </p>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        <table className="min-w-[1080px] w-full border-collapse">
                          <thead>
                            <tr>
                              <th className={th}>Paket</th>
                              <th className={th}>Harga paket</th>
                              <th className={`${th} text-right`}>Jumlah belum</th>
                              <th className={`${th} text-right`}>Belum bayar</th>
                              <th className={`${th} text-right`}>Jumlah sudah</th>
                              <th className={`${th} text-right`}>Sudah bayar</th>
                              <th className={`${th} text-right`}>Jumlah tunai</th>
                              <th className={`${th} text-right`}>Tunai</th>
                              <th className={`${th} text-right`}>Jumlah transfer</th>
                              <th className={`${th} text-right`}>Transfer</th>
                              <th className={`${th} text-right`}>Total ditagih</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={row.paketId} className="bg-white">
                                <td className={td}>{row.nama}</td>
                                <td className={td}>{formatIdr(row.harga)}</td>
                                <td className={`${td} text-right`}>{row.jumlahBelum}</td>
                                <td className={`${td} text-right text-rose-700`}>
                                  {formatIdr(row.nominalBelum)}
                                </td>
                                <td className={`${td} text-right`}>{row.jumlahSudah}</td>
                                <td className={`${td} text-right text-emerald-700`}>
                                  {formatIdr(row.nominalSudah)}
                                </td>
                                <td className={`${td} text-right`}>{row.jumlahTunai}</td>
                                <td className={`${td} text-right text-amber-800`}>
                                  {formatIdr(row.nominalTunai)}
                                </td>
                                <td className={`${td} text-right`}>{row.jumlahTransfer}</td>
                                <td className={`${td} text-right text-indigo-700`}>
                                  {formatIdr(row.nominalTransfer)}
                                </td>
                                <td className={`${td} text-right font-medium`}>
                                  {formatIdr(row.nominalBelum + row.nominalSudah)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-100 font-semibold">
                              <td className={td} colSpan={2}>
                                Total
                              </td>
                              <td className={`${td} text-right`}>{totals.jumlahBelum}</td>
                              <td className={`${td} text-right text-rose-700`}>
                                {formatIdr(totals.nominalBelum)}
                              </td>
                              <td className={`${td} text-right`}>{totals.jumlahSudah}</td>
                              <td className={`${td} text-right text-emerald-700`}>
                                {formatIdr(totals.nominalSudah)}
                              </td>
                              <td className={`${td} text-right`}>{totals.jumlahTunai}</td>
                              <td className={`${td} text-right text-amber-800`}>
                                {formatIdr(totals.nominalTunai)}
                              </td>
                              <td className={`${td} text-right`}>{totals.jumlahTransfer}</td>
                              <td className={`${td} text-right text-indigo-700`}>
                                {formatIdr(totals.nominalTransfer)}
                              </td>
                              <td className={`${td} text-right`}>{formatIdr(totalDitagih)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
