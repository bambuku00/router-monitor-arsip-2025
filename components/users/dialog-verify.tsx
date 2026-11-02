import { Button } from "@/components/button";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { EditAction, EditState } from "./data";

type Props = {
  verify: EditState;
  verifyDispatch: React.Dispatch<EditAction>;
};

export default function DialogVerify({ verify, verifyDispatch }: Props) {
  const { refresh } = useRouter();
  const show = useMemo(() => {
    return verify.modal;
  }, [verify]);
  const close = () => {
    verifyDispatch({ action: "close" });
    setTimeout(() => verifyDispatch({ action: "data", data: undefined }), 300);
  };
  const val = useMemo(() => verify.data, [verify]);

  const [mutatingVerify, setMutatingVerify] = useState<boolean>(false);
  const verifyHandler = async () => {
    setMutatingVerify(true);
    try {
      const post = await fetch(`/api/user/${verify.data?.id}/verify`, {
        method: "PATCH",
      });
      const resp = await post.json();
      if (resp.error) throw new Error(resp.error);
      if (!resp.data?.id) throw new Error("Gagal memverifikasi user");
      toast.success(resp.message);
      verifyDispatch({ action: "close" });
      refresh();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
      console.error(error.message);
    } finally {
      setMutatingVerify(false);
    }
  };

  return (
    <Dialog
      open={verify.modal}
      as="div"
      className="relative z-[1001]"
      onClose={() => verifyDispatch({ action: "close" })}
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black bg-opacity-25 duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <DialogPanel
            transition
            className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 py-4 text-left text-gray-900 align-middle shadow-xl duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
          >
            <DialogTitle as="h3" className="text-base/7 font-medium">
              Verifikasi Admin
            </DialogTitle>
            <p className="mt-2 text-sm/6">User akan diverifikasi/diaktifkan.</p>
            <div className="mt-4 flex gap-1 items-center justify-end">
              <Button
                color="green"
                onClick={verifyHandler}
                loading={mutatingVerify}
              >
                Verifikasi
              </Button>
              <Button
                color="red100"
                onClick={() => verifyDispatch({ action: "close" })}
              >
                Batal
              </Button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
