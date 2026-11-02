import { Button } from "@/components/button";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React from "react";
import { IoSyncOutline } from "react-icons/io5";

type Props = {
  isOpen: boolean;
  close: () => void;
  onConfirm: () => void;
  mutating: boolean;
  periodLabel?: string;
};

export default function DialogGenerate({
  isOpen,
  close,
  onConfirm,
  mutating,
  periodLabel,
}: Props) {
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
                  <IoSyncOutline className="size-6 text-sky-600" />
                  Generate Tagihan
                </DialogTitle>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Generate tagihan untuk mitra ini pada periode{" "}
                    <strong>{periodLabel || "bulan yang dipilih di statistik"}</strong>.
                    Hanya pelanggan aktif yang terhubung PPP yang akan dibuatkan
                    tagihan.
                  </p>
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
                    onClick={onConfirm}
                    disabled={mutating}
                    loading={mutating}
                  >
                    Generate
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
