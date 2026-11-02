import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { EditState } from "@/lib/ppp-types";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PembayaranLoadDataOpts, PembayaranState } from "./data";
import { delPembayaran } from "@/lib/server-actions/pembayaran/actions";
import { cn } from "@/lib/utils";
import InputPassword from "../auth/input-password";

type Props = {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  closeParent: () => void;
  data: PembayaranState["data"] | null | undefined;
  loadData: (opts?: PembayaranLoadDataOpts) => Promise<void>;
};
export default function DialogDelete({
  show,
  setShow,
  closeParent,
  data,
  loadData,
}: Props) {
  const close = () => {
    setShow(false);
    setPassword("");
  };

  const [tanggal, setTanggal] = useState<string>();
  useEffect(() => {
    if (!show) return;
    setTanggal(new Date().toLocaleDateString("fr-CA"));
  }, [show]);

  const [password, setPassword] = useState("");
  const passwordHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const [mutating, setMutating] = useState<boolean>(false);
  const hapusHandler = async (e: React.MouseEvent) => {
    e?.preventDefault();
    setMutating(true);
    try {
      if (!data) return;
      const del = await delPembayaran(data.pembayaran.id, password);
      if (!del.success)
        throw new Error(del.error || "Terjadi kesalahan pada server");
      toast.success(del.success);
      close();
      closeParent();
      await loadData({ refreshStats: true, silent: true });
    } catch (err) {
      const error = err as Error;
      toast.error("Terjadi kesalahan pada server");
      console.error(error);
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
                  Hapus Pembayaran
                </DialogTitle>
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-gray-500">
                    Atas nama {data?.nama} pada tanggal jatuh tempo{" "}
                    {data?.pembayaran.jatuh_tempo}
                  </p>
                  {/* <div className={cn("grid gap-1.5 rounded-lg")}>
                    <InputPassword
                      value={password}
                      onChange={passwordHandler}
                    />
                  </div> */}
                </div>
                <div className="mt-4 flex justify-end gap-1">
                  <Button color="red" onClick={hapusHandler} loading={mutating}>
                    Hapus
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
