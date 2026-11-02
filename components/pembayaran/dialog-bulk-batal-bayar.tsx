import { Button } from "@/components/button";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { PembayaranLoadDataOpts } from "./data";

type Props = {
  ids: number[];
  show: boolean;
  onClose: () => void;
  loadData: (opts?: PembayaranLoadDataOpts) => Promise<void>;
};

function apiErrorMessage(json: unknown, resp: Response): string {
  if (typeof json === "string") return json;
  if (json && typeof json === "object") {
    const o = json as { message?: unknown; error?: unknown };
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
  }
  return resp.statusText || "Terjadi kesalahan";
}

export default function DialogBulkBatalBayar({
  ids,
  show,
  onClose,
  loadData,
}: Props) {
  const [mutating, setMutating] = useState(false);

  const submitHandler = async () => {
    setMutating(true);
    try {
      const resp = await fetch(`/api/pembayaran/bulk-revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      let json: unknown;
      try {
        json = await resp.json();
      } catch {
        json = null;
      }
      if (!resp.ok) throw new Error(apiErrorMessage(json, resp));

      toast.success(
        typeof json === "object" &&
          json &&
          typeof (json as { message?: string }).message === "string"
          ? (json as { message: string }).message
          : "Selesai"
      );
      await loadData({ refreshStats: true, silent: true });
      onClose();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
      console.error(error);
    } finally {
      setMutating(false);
    }
  };

  return (
    <Transition show={show} as={React.Fragment}>
      <Dialog as="div" className="relative z-[1001]" onClose={onClose}>
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
              <DialogPanel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white p-6 pb-2 text-left text-gray-900 align-middle shadow-xl transition-all">
                <DialogTitle
                  as="div"
                  className="flex sticky -top-6 z-50 bg-white justify-between items-center border-b border-slate-200 font-medium leading-6 text-gray-900"
                >
                  <p className="text-base/7 text-center font-semibold">
                    Batalkan pembayaran ({ids.length} tagihan Terbayar)
                  </p>
                </DialogTitle>
                <div className="relative py-2 grid gap-2.5">
                  <p className="text-sm text-slate-700">
                    Tagihan dengan status Terbayar yang dipilih akan dikembalikan
                    ke Belum. Lanjutkan?
                  </p>
                  <div className="sticky -bottom-4 mt-4 border-t gap-1 bg-white border-slate-200 py-2 flex justify-end">
                    <Button
                      type="button"
                      color="amber"
                      loading={mutating}
                      onClick={submitHandler}
                    >
                      Batalkan pembayaran
                    </Button>
                    <Button color="red100" onClick={onClose}>
                      Tutup
                    </Button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
