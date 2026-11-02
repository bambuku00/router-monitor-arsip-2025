"use client";

import { Button } from "@/components/button";
import { bulkDelAllUnpaidPembayaranMitraBulan } from "@/lib/server-actions/pembayaran/actions";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Field,
  Label,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import InputPassword from "../auth/input-password";
import { PembayaranLoadDataOpts } from "./data";

type Props = {
  mitraUserId: number;
  bulan: string;
  show: boolean;
  onClose: () => void;
  loadData: (opts?: PembayaranLoadDataOpts) => Promise<void>;
};

export default function DialogHapusSemuaTagihan({
  mitraUserId,
  bulan,
  show,
  onClose,
  loadData,
}: Props) {
  const [password, setPassword] = useState("");
  const [mutating, setMutating] = useState(false);

  const bulanLabel = /^\d{4}-\d{2}$/.test(bulan.trim())
    ? new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(new Date(`${bulan.trim()}-01`))
    : bulan;

  useEffect(() => {
    if (!show) setPassword("");
  }, [show]);

  const handleClose = () => {
    if (!mutating) onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutating(true);
    try {
      const res = await bulkDelAllUnpaidPembayaranMitraBulan(
        mitraUserId,
        bulan.trim(),
        password
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.success) toast.success(res.success);
      await loadData({ refreshStats: true, silent: true });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan pada server");
    } finally {
      setMutating(false);
    }
  };

  return (
    <Transition show={show} as={React.Fragment}>
      <Dialog as="div" className="relative z-[1001]" onClose={handleClose}>
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
              leaveTo="opacity-0 translate-x-5 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 pb-2 text-left text-gray-900 align-middle shadow-xl transition-all">
                <DialogTitle
                  as="div"
                  className="flex sticky -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
                >
                  <p className="text-base/7 font-semibold">
                    Reset tagihan bulan (belum bayar saja)
                  </p>
                </DialogTitle>
                <form className="relative py-2 grid gap-2.5" onSubmit={submit}>
                  <input
                    type="text"
                    name="dummy_username"
                    autoComplete="username"
                    className="hidden"
                    tabIndex={-1}
                  />
                  <p className="text-sm text-slate-600">
                    Menghapus dari <strong>database</strong> untuk mitra ini pada{" "}
                    <strong>{bulanLabel}</strong>: hanya tagihan status{" "}
                    <strong>Belum</strong> (belum bayar). Tagihan yang sudah{" "}
                    <strong>Terbayar</strong> tidak dihapus. Log generate bulan
                    tersebut dihapus agar bisa generate ulang. Pelanggan duplikat
                    tanpa PPP ikut dibersihkan.
                  </p>
                  <Field className={cn("grid gap-1.5 rounded-lg")}>
                    <Label className="text-sm/6 font-medium">Password*</Label>
                    <InputPassword
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                  <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex justify-end">
                    <Button
                      type="submit"
                      color="red"
                      loading={mutating}
                      disabled={!password.trim()}
                    >
                      Reset belum bayar
                    </Button>
                    <Button
                      type="button"
                      color="red100"
                      onClick={handleClose}
                      disabled={mutating}
                    >
                      Tutup
                    </Button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
