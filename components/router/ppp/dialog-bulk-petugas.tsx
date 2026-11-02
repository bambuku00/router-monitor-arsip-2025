"use client";

import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Select,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React from "react";
import { TbChevronDown, TbUsers } from "react-icons/tb";

type PetugasOption = {
  id: number;
  nama: string;
  aktif: boolean;
};

export type BulkPetugasMode = "tambah" | "ubah" | "hapus";

type Props = {
  isOpen: boolean;
  close: () => void;
  onConfirm: (penagihId: number | null) => void;
  mutating: boolean;
  count: number;
  options: PetugasOption[];
  loading: boolean;
  mode: BulkPetugasMode;
};

export default function DialogBulkPetugas({
  isOpen,
  close,
  onConfirm,
  mutating,
  count,
  options,
  loading,
  mode,
}: Props) {
  const [penagihId, setPenagihId] = React.useState("");
  const aktifOptions = options.filter((row) => row.aktif);
  const isTambah = mode === "tambah";
  const isHapus = mode === "hapus";

  React.useEffect(() => {
    if (isOpen) setPenagihId("");
  }, [isOpen, mode]);

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
                  <TbUsers className="size-6 text-sky-600" />
                  {isHapus
                    ? "Hapus petugas PPPoE"
                    : isTambah
                      ? "Tambah petugas PPPoE"
                      : "Ubah petugas PPPoE"}
                </DialogTitle>
                <div className="mt-2 space-y-3 text-sm text-gray-600">
                  {isHapus ? (
                    <p>
                      Lepas petugas dari{" "}
                      <strong>{count.toLocaleString("id-ID")}</strong> pelanggan
                      PPPoE yang dipilih. Pelanggan tetap ada; hanya penugasan
                      petugas yang dihapus.
                    </p>
                  ) : (
                    <>
                      <p>
                        {isTambah
                          ? "Tetapkan petugas untuk "
                          : "Ganti petugas untuk "}
                        <strong>{count.toLocaleString("id-ID")}</strong> pelanggan
                        PPPoE yang dipilih.
                      </p>
                      <label className="block">
                        <span className="text-sm font-medium text-slate-800">
                          Petugas
                        </span>
                        <div className="relative mt-1">
                          <Select
                            className={cn(
                              "block w-full appearance-none rounded-lg border-none py-1.5 px-3 text-sm/6 bg-slate-200/80",
                              "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25",
                              "*:text-black"
                            )}
                            value={penagihId}
                            disabled={loading || mutating}
                            onChange={(e) => setPenagihId(e.target.value)}
                          >
                            <option value="">
                              {isTambah ? "Pilih petugas" : "Belum ditugaskan"}
                            </option>
                            {aktifOptions.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.nama}
                              </option>
                            ))}
                          </Select>
                          <TbChevronDown
                            className="pointer-events-none absolute top-2.5 right-2.5 size-4 fill-white/60"
                            aria-hidden="true"
                          />
                        </div>
                      </label>
                      {loading ? (
                        <p className="text-xs text-slate-500">Memuat petugas…</p>
                      ) : aktifOptions.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Belum ada petugas aktif. Tambah di halaman Petugas.
                        </p>
                      ) : isTambah ? (
                        <p className="text-xs text-slate-500">
                          Hanya pelanggan yang belum punya petugas yang bisa
                          dipilih.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Pilih petugas baru, atau &quot;Belum ditugaskan&quot;
                          untuk melepas petugas.
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    color="slatesky"
                    disabled={mutating}
                    onClick={close}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    color={isHapus ? "red" : undefined}
                    disabled={
                      mutating ||
                      (!isHapus && loading) ||
                      (isTambah && penagihId === "")
                    }
                    onClick={() =>
                      onConfirm(
                        isHapus || penagihId === "" ? null : Number(penagihId)
                      )
                    }
                  >
                    {mutating
                      ? isHapus
                        ? "Menghapus…"
                        : "Menyimpan…"
                      : isHapus
                        ? "Hapus"
                        : "Simpan"}
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
