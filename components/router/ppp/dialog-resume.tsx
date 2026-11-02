import { Button } from "@/components/button";
import { getErrorMessage, throwIfPelangganApiFailed } from "@/lib/get-error-message";
import { EditState } from "@/lib/ppp-types";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  closeParent: () => void;
  data: EditState["data"] | null | undefined;
};

export default function DialogResume({
  show,
  setShow,
  closeParent,
  data,
}: Props) {
  const { refresh } = useRouter();

  const close = () => {
    setShow(false);
  };

  const [mutating, setMutating] = useState<boolean>(false);
  const resumeHandler = async (e: React.MouseEvent) => {
    e?.preventDefault();
    setMutating(true);
    try {
      const put = await fetch(`/api/router/ppp/pelanggan/${data?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stop: false,
          tgl_stop: null,
        }),
      });
      const resp = await put.json();
      throwIfPelangganApiFailed(
        put,
        resp,
        "Gagal mengaktifkan kembali langganan pelanggan"
      );
      toast.success(
        `Data pelanggan ${data?.pelanggan?.nama} telah mulai berlangganan kembali`
      );
      close();
      closeParent();
      refresh();
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Gagal mengaktifkan kembali langganan pelanggan")
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
                  Mulai Berlangganan Kembali
                </DialogTitle>
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-gray-500">
                    Apakah Anda yakin ingin mengaktifkan kembali langganan atas
                    nama {data?.pelanggan?.nama} dan PPP {data?.name}?
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-1">
                  <Button
                    color="sky"
                    onClick={resumeHandler}
                    loading={mutating}
                  >
                    Mulai Berlangganan
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
