"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { getApiResponseErrorMessage } from "@/lib/get-error-message";
import { portalPinError } from "@/lib/portal-slug";
import { GetPPP } from "@/lib/server-actions/router/ppp/actions";
import { ArrayElementType } from "@/lib/utils";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React, { useState } from "react";
import toast from "react-hot-toast";

type Row = ArrayElementType<GetPPP["data"]>;

export default function DialogPortalPin({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: (secretId: number, pinSendiri: boolean) => void;
}) {
  const [pin, setPin] = useState("");
  const [ulang, setUlang] = useState("");
  const [saving, setSaving] = useState(false);
  const pelanggan = row?.pelanggan;

  const close = () => {
    if (saving) return;
    setPin("");
    setUlang("");
    onClose();
  };

  const submit = async (mode: "set" | "mitra") => {
    if (!row || !pelanggan) return;
    if (mode === "set") {
      const trimmed = pin.trim();
      const err = portalPinError(trimmed);
      if (!trimmed || err) {
        toast.error(err || "Isi PIN baru.");
        return;
      }
      if (trimmed !== ulang.trim()) {
        toast.error("Ulangan PIN tidak sama.");
        return;
      }
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/router/ppp/pelanggan/${row.id}/portal-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "mitra" ? { mode } : { mode, pin: pin.trim() }
          ),
        }
      );
      const json = (await response.json().catch(() => null)) as {
        pinSendiri?: boolean;
      } | null;
      if (!response.ok || typeof json?.pinSendiri !== "boolean") {
        throw new Error(
          getApiResponseErrorMessage(json, response, "Gagal menyimpan PIN portal")
        );
      }
      onSaved(row.id, json.pinSendiri);
      toast.success(
        json.pinSendiri
          ? "PIN pelanggan disimpan. Beritahu PIN ini kepada pelanggan."
          : "Pelanggan kembali memakai PIN mitra."
      );
      setPin("");
      setUlang("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan PIN portal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Transition show={row !== null} as={React.Fragment}>
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
                  PIN portal pelanggan
                </DialogTitle>
                <p className="mt-2 text-sm text-gray-500">
                  {pelanggan?.nama} ({row?.name}){" "}
                  {pelanggan?.pinSendiri
                    ? "memakai PIN sendiri."
                    : "memakai PIN mitra."}
                </p>
                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-sm">
                    PIN baru
                    <Input
                      type="password"
                      autoComplete="new-password"
                      maxLength={32}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.slice(0, 32))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Ulangi PIN baru
                    <Input
                      type="password"
                      autoComplete="new-password"
                      maxLength={32}
                      value={ulang}
                      onChange={(e) => setUlang(e.target.value.slice(0, 32))}
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    4–32 karakter. PIN tidak ditampilkan lagi setelah disimpan.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button color="red100" onClick={close} disabled={saving}>
                    Batal
                  </Button>
                  <Button
                    color="slatesky"
                    onClick={() => submit("mitra")}
                    disabled={saving || !pelanggan?.pinSendiri}
                  >
                    Pakai PIN mitra
                  </Button>
                  <Button
                    color="sky"
                    onClick={() => submit("set")}
                    loading={saving}
                  >
                    Simpan PIN
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
