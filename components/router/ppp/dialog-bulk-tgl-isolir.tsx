"use client";

import { Button } from "@/components/button";
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
  onConfirm: (day: number) => void;
  mutating: boolean;
  count: number;
};

export default function DialogBulkTglIsolir({
  isOpen,
  close,
  onConfirm,
  mutating,
  count,
}: Props) {
  const [day, setDay] = React.useState("1");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setDay("1");
      setError(null);
    }
  }, [isOpen]);

  const submit = () => {
    const n = Number(day);
    if (!Number.isInteger(n) || n < 1 || n > 30) {
      setError("Isi angka 1 sampai 30");
      return;
    }
    setError(null);
    onConfirm(n);
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
                  Tanggal isolir semua pelanggan
                </DialogTitle>
                <div className="mt-2 space-y-3 text-sm text-gray-600">
                  <p>
                    Satu tanggal dipakai untuk{" "}
                    <strong>{count.toLocaleString("id-ID")}</strong> pelanggan
                    di router ini. Mereka ikut auto isolir pada hari itu setiap
                    bulan.
                  </p>
                  <p className="text-xs text-slate-600">
                    Tanggal yang sudah terisi akan diganti. Pelanggan yang
                    butuh hari berbeda tetap bisa diubah satu per satu lewat
                    Edit.
                  </p>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-800">
                      Hari isolir (1–30)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={day}
                      disabled={mutating}
                      onChange={(e) => {
                        setDay(e.target.value);
                        if (error) setError(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm"
                    />
                    {error ? (
                      <span className="mt-1 block text-xs text-red-500">
                        {error}
                      </span>
                    ) : null}
                  </label>
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
                    Terapkan ke semua
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
