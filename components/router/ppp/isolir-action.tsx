"use client";

import { Button } from "@/components/button";
import { isPppIsolir, isolirActionLabel, type PppIsolirRow } from "@/lib/ppp-isolir";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Tooltip } from "@mui/material";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaPowerOff } from "react-icons/fa6";

export type PppIsolirTarget = PppIsolirRow & {
  name: string;
  on_router?: boolean;
};

type Props = {
  routerId: number;
  isolirProfileName?: string | null;
  ppp: PppIsolirTarget | null | undefined;
  /** Pelanggan berhenti atau tidak ada PPP */
  hidden?: boolean;
  disabled?: boolean;
  onSuccess?: () => void;
  className?: string;
};

export default function PppIsolirAction({
  routerId,
  isolirProfileName,
  ppp,
  hidden = false,
  disabled = false,
  onSuccess,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isolirCtx = useMemo(
    () => ({ isolirProfileName }),
    [isolirProfileName]
  );

  if (hidden || !ppp?.name) return null;

  const currentlyIsolir = isPppIsolir(ppp, isolirCtx);

  const handleConfirm = async () => {
    setLoading(true);
    const toastLoad = toast.loading("Mengubah status isolir...");
    try {
      const resp = await fetch(
        `/api/router/${routerId}/ppp/disable/${encodeURIComponent(ppp.name)}`,
        { method: "POST" }
      );
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(
          getErrorMessage(
            json.error ?? json,
            json.permissionDenied
              ? "Router menolak akses untuk perubahan data. Harap ubah lewat mikrotik lalu sinkron ulang!"
              : "Gagal mengubah data"
          )
        );
      }
      if (json.permissionDenied) {
        toast("PPP hanya terubah di netmon. Harap cek ulang di mikrotik!", {
          id: toastLoad,
          icon: "⚠️",
        });
      } else {
        toast.success("Status isolir PPP berhasil diubah!", { id: toastLoad });
      }
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Terjadi kesalahan pada server"), {
        id: toastLoad,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={isolirActionLabel(ppp, isolirCtx)}>
        <Button
          type="button"
          color="slatesky"
          disabled={disabled || loading}
          className={cn(
            "rounded py-0.5 relative",
            currentlyIsolir
              ? "ring-1 ring-red-400/80"
              : "ring-1 ring-green-400/80",
            className
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <FaPowerOff
            className={cn(
              "size-4",
              currentlyIsolir ? "text-red-600" : "text-green-600"
            )}
          />
        </Button>
      </Tooltip>

      <Dialog
        open={open}
        as="div"
        className="relative z-[1001]"
        onClose={() => !loading && setOpen(false)}
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black bg-opacity-25 duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <DialogPanel
              transition
              className="flex flex-col gap-1 w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 py-4 text-left text-gray-900 align-middle shadow-xl duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
            >
              <DialogTitle as="h3" className="text-base/7 font-medium">
                {currentlyIsolir ? "Buka Isolir" : "Isolir"}
              </DialogTitle>
              <p className="text-sm/6">
                {currentlyIsolir ? "Buka isolir" : "Isolir"} PPP Secret{" "}
                <span className="font-medium">{ppp.name}</span>
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  color="slatesky"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  color="slatesky"
                  disabled={loading}
                  onClick={handleConfirm}
                >
                  {currentlyIsolir ? "Buka Isolir" : "Isolir"}
                </Button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
