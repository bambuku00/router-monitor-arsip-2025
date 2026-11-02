"use client";

import { Button } from "@/components/button";
import { InputDate } from "@/components/input";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  getErrorMessage,
  throwIfPelangganApiFailed,
} from "@/lib/get-error-message";

export type BerhentiPelangganTarget = {
  id: number;
  nama: string;
  ppp_secretId: number | null;
  ppp_secret?: { name: string } | null;
};

type Props = {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  data: BerhentiPelangganTarget | null;
  onSuccess?: () => void;
};

export default function DialogBerhentiPelanggan({
  show,
  setShow,
  data,
  onSuccess,
}: Props) {
  const close = () => setShow(false);

  const [tanggal, setTanggal] = useState<string>();
  useEffect(() => {
    if (!show) return;
    setTanggal(new Date().toLocaleDateString("fr-CA"));
  }, [show]);

  const [mutating, setMutating] = useState(false);

  const berhentiHandler = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!data?.ppp_secretId) {
      toast.error("Pelanggan tidak terhubung ke PPP");
      return;
    }
    setMutating(true);
    try {
      if (!tanggal) throw new Error("Tanggal berhenti tidak valid");
      const put = await fetch(
        `/api/router/ppp/pelanggan/${data.ppp_secretId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stop: true,
            tgl_stop: tanggal,
          }),
        }
      );
      const resp = await put.json();
      throwIfPelangganApiFailed(
        put,
        resp,
        "Gagal menghentikan langganan pelanggan"
      );
      toast.success(
        `${data.nama} berhenti berlangganan. Tagihan bulan ini tetap; bulan depan tidak ada tagihan baru.`
      );
      close();
      onSuccess?.();
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Gagal menghentikan langganan pelanggan")
      );
      console.error(err);
    } finally {
      setMutating(false);
    }
  };

  return (
    <Transition show={show} as={React.Fragment}>
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
              leave="ease-in duration-50"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left text-gray-900 align-middle shadow-xl transition-all">
                <DialogTitle as="p" className="font-medium leading-6">
                  Berhenti Berlangganan
                </DialogTitle>
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-gray-500">
                    {data?.nama}
                    {data?.ppp_secret?.name
                      ? ` (PPP ${data.ppp_secret.name})`
                      : ""}{" "}
                    berhenti pada tanggal
                  </p>
                  <InputDate
                    value={tanggal ?? ""}
                    onChange={(val) => setTanggal(val)}
                  />
                  <p className="text-xs text-amber-700">
                    Tagihan bulan ini tidak dihapus. Mulai bulan depan, tagihan
                    baru tidak dibuat untuk pelanggan ini.
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-1">
                  <Button
                    color="red"
                    onClick={berhentiHandler}
                    loading={mutating}
                  >
                    Berhenti
                  </Button>
                  <Button color="red100" onClick={close}>
                    Batal
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
