"use client";

import { Button } from "@/components/button";
import { syncPaketFromMikrotik } from "@/lib/server-actions/paket/actions";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Router } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TbRefresh } from "react-icons/tb";

type Props = {
  routers: Pick<Router, "id" | "nama" | "host">[];
};

export default function SyncPaketMikrotik({ routers }: Props) {
  const { refresh } = useRouter();
  const [open, setOpen] = useState(false);
  const [routerId, setRouterId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const defaultRouterId = useMemo(
    () => (routers[0] ? String(routers[0].id) : ""),
    [routers]
  );

  useEffect(() => {
    if (open) setRouterId(defaultRouterId);
  }, [open, defaultRouterId]);

  const handleSync = async () => {
    const id = parseInt(routerId, 10);
    if (!id) {
      toast.error("Pilih router terlebih dahulu");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Menyinkron profile PPP...");
    try {
      const result = await syncPaketFromMikrotik(id);
      if ("error" in result) throw new Error(result.error);

      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} paket baru`);
      if (result.skipped > 0) parts.push(`${result.skipped} sudah ada / dilewati`);

      toast.success(
        parts.length > 0
          ? `Sinkron selesai — ${parts.join(", ")}`
          : "Semua profile sudah ada, tidak ada perubahan",
        { id: toastId }
      );
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (routers.length === 0) return null;

  return (
    <>
      <Button
        color="cyan100"
        className="text-xs py-0.5 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        <TbRefresh className="size-3.5 shrink-0" />
        Sinkron Profile
      </Button>

      <Dialog open={open} onClose={() => !loading && setOpen(false)} className="relative z-[1001]">
        <DialogBackdrop className="fixed inset-0 bg-black/25" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <DialogTitle className="text-base font-medium">
                Sinkron Paket dari Router
              </DialogTitle>
              <p className="mt-2 text-sm text-slate-600">
                Profile PPP baru di Mikrotik akan ditambahkan sebagai paket, hanya
                namanya. Kapasitas dan harga diisi manual setelah sinkron. Paket yang
                sudah ada tidak akan ditimpa, dan kolom Router mencatat router ini.
              </p>

              {routers.length > 1 ? (
                <div className="mt-4">
                  <label className="text-sm font-medium block mb-1.5">
                    Pilih Router
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-md text-sm p-2"
                    value={routerId}
                    onChange={(e) => setRouterId(e.target.value)}
                    disabled={loading}
                  >
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nama} ({r.host})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-700">
                  Router: <span className="font-medium">{routers[0].nama}</span>
                </p>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  color="red100"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Batal
                </Button>
                <Button color="green100" loading={loading} onClick={handleSync}>
                  Sinkronkan
                </Button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
