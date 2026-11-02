"use client";

import { Button } from "@/components/button";
import {
  formatSubscriptionDate,
  shiftSubscriptionYearMonth,
  subscriptionYearMonth,
  type SubscriptionMonthOption,
} from "@/lib/ppp-subscription-month";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React from "react";
import { TbCalendar } from "react-icons/tb";

type Props = {
  isOpen: boolean;
  close: () => void;
  onConfirm: (dari: string, ke: string, hari: number | null) => void;
  mutating: boolean;
  months: SubscriptionMonthOption[];
};

type Mode = "bulan" | "bulan-tanggal";

export default function DialogBulkTglBerlangganan({
  isOpen,
  close,
  onConfirm,
  mutating,
  months,
}: Props) {
  const [dari, setDari] = React.useState("");
  const [ke, setKe] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("bulan");
  const [hari, setHari] = React.useState("1");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const first = months[0]?.tanggal ?? "";
    const firstMonth = subscriptionYearMonth(first);
    setDari(first);
    setKe(firstMonth ? shiftSubscriptionYearMonth(firstMonth, -1) : "");
    setMode("bulan");
    setHari("1");
    setError(null);
  }, [isOpen, months]);

  const selected = months.find((item) => item.tanggal === dari);
  const count = selected?.count ?? 0;

  const submit = () => {
    if (!selected) {
      setError("Pilih tanggal yang ada");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(ke)) {
      setError("Pilih bulan tujuan");
      return;
    }
    if (mode === "bulan" && subscriptionYearMonth(dari) === ke) {
      setError("Bulan tujuan harus berbeda");
      return;
    }
    if (mode === "bulan-tanggal") {
      const day = Number(hari);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        setError("Isi tanggal 1 sampai 31");
        return;
      }
      setError(null);
      onConfirm(dari, ke, day);
      return;
    }
    setError(null);
    onConfirm(dari, ke, null);
  };

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-[1001]" onClose={close}>
        <TransitionChild
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 flex items-center gap-2"
                >
                  <TbCalendar className="size-6 text-sky-600" />
                  Ubah tanggal berlangganan
                </DialogTitle>
                <div className="mt-2 space-y-3 text-sm text-gray-600">
                  <p>
                    Pilih tanggal berlangganan yang sudah ada. Hari yang berbeda
                    di bulan yang sama tidak digabung. Hanya pelanggan pada
                    tanggal itu yang dipindah.
                  </p>
                  <fieldset className="space-y-1.5">
                    <legend className="text-sm font-medium text-slate-800">
                      Yang diubah
                    </legend>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="mode-tgl-berlangganan"
                        checked={mode === "bulan"}
                        disabled={mutating}
                        onChange={() => {
                          setMode("bulan");
                          if (error) setError(null);
                        }}
                      />
                      <span>Cukup ubah bulan, hari tiap pelanggan tetap</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="mode-tgl-berlangganan"
                        checked={mode === "bulan-tanggal"}
                        disabled={mutating}
                        onChange={() => {
                          setMode("bulan-tanggal");
                          if (error) setError(null);
                        }}
                      />
                      <span>Ubah bulan dan tanggal</span>
                    </label>
                  </fieldset>
                  <p className="text-xs text-slate-600">
                    {mode === "bulan"
                      ? "Contoh: 18 Oktober jadi 18 September. Tagihan yang sudah ada tidak diubah."
                      : "Semua pelanggan pada tanggal yang dipilih memakai tanggal baru yang sama. Tanggal 31 di bulan pendek menjadi akhir bulan. Tagihan yang sudah ada tidak diubah."}
                  </p>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-800">
                      Bulan dan tanggal yang ada
                    </span>
                    <select
                      value={dari}
                      disabled={mutating || months.length === 0}
                      onChange={(e) => {
                        const next = e.target.value;
                        const nextMonth = subscriptionYearMonth(next);
                        setDari(next);
                        setKe((current) =>
                          nextMonth && current === nextMonth
                            ? shiftSubscriptionYearMonth(nextMonth, -1)
                            : current
                        );
                        if (error) setError(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm"
                    >
                      {months.map((item) => (
                        <option key={item.tanggal} value={item.tanggal}>
                          {formatSubscriptionDate(item.tanggal)} (
                          {item.count.toLocaleString("id-ID")} pelanggan)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-800">
                      Pindah ke bulan
                    </span>
                    <input
                      type="month"
                      value={ke}
                      disabled={mutating}
                      onChange={(e) => {
                        setKe(e.target.value);
                        if (error) setError(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm"
                    />
                  </label>
                  {mode === "bulan-tanggal" ? (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-800">
                        Tanggal (1–31)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={hari}
                        disabled={mutating}
                        onChange={(e) => {
                          setHari(e.target.value);
                          if (error) setError(null);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm"
                      />
                    </label>
                  ) : null}
                  {error ? (
                    <span className="block text-xs text-red-500">{error}</span>
                  ) : null}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    color="slatesky"
                    onClick={close}
                    disabled={mutating}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    color="sky"
                    onClick={submit}
                    disabled={mutating || count === 0}
                    loading={mutating}
                  >
                    Pindahkan {count.toLocaleString("id-ID")} pelanggan
                  </Button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
