"use client";

import { Button } from "@/components/button";
import {
  deleteUnusedPaketsMissingFromMikrotik,
  scanPaketsMissingFromMikrotik,
  type PaketMissingFromMikrotikResult,
} from "@/lib/server-actions/paket/actions";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TbTrash } from "react-icons/tb";

export type PaketRouterPlacement = {
  id: number;
  nama: string;
  routers: string[];
  unchecked: boolean;
};

function RouterPaketSummary({
  placements,
}: {
  placements: PaketRouterPlacement[];
}) {
  const byRouter = new Map<string, string[]>();
  for (const row of placements) {
    for (const router of row.routers) {
      const names = byRouter.get(router) ?? [];
      names.push(row.nama);
      byRouter.set(router, names);
    }
  }
  return (
    <div className="mt-1 space-y-2 text-xs text-slate-600">
      {[...byRouter.entries()].map(([router, names]) => (
        <div key={router}>
          <p className="font-medium text-slate-800">{router}</p>
          <p>{names.join(", ")}</p>
        </div>
      ))}
    </div>
  );
}

export default function DeleteMissingMikrotik({
  onUsedMissing,
  onPlacements,
}: {
  onUsedMissing: (ids: number[]) => void;
  onPlacements: (rows: PaketRouterPlacement[]) => void;
}) {
  const { refresh } = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<PaketMissingFromMikrotikResult | null>(null);

  const close = () => {
    if (loading || deleting) return;
    setOpen(false);
  };

  const scan = async () => {
    setOpen(true);
    setLoading(true);
    setResult(null);
    const toastId = toast.loading("Membaca profil di Mikrotik...");
    try {
      const scanned = await scanPaketsMissingFromMikrotik();
      if ("error" in scanned) throw new Error(scanned.error);
      setResult(scanned);
      onUsedMissing(scanned.usedMissing.map((row) => row.id));
      onPlacements(scanned.placements);
      toast.success("Pemeriksaan profil selesai", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membaca Mikrotik", {
        id: toastId,
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    const toastId = toast.loading("Menghapus paket...");
    try {
      const deleted = await deleteUnusedPaketsMissingFromMikrotik();
      if ("error" in deleted) throw new Error(deleted.error);
      toast.success(
        deleted.deleted > 0
          ? `${deleted.deleted} paket dihapus`
          : "Tidak ada paket yang dihapus",
        { id: toastId }
      );
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus paket", {
        id: toastId,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        color="red100"
        className="text-xs py-0.5 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
        onClick={() => void scan()}
      >
        <TbTrash className="size-3.5 shrink-0" />
        Hapus massal
      </Button>
      <Dialog open={open} onClose={close} className="relative z-[1001]">
        <DialogBackdrop className="fixed inset-0 bg-black/25" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-xl">
              <DialogTitle className="text-base font-medium">
                Hapus paket di luar Mikrotik
              </DialogTitle>
              {loading || !result ? (
                <p className="mt-2 text-sm text-slate-600">Memeriksa nama profil...</p>
              ) : (
                <div className="mt-2 flex flex-col gap-3 text-sm text-slate-700">
                  <p>
                    {result.deletable.length > 0
                      ? `${result.deletable.length} paket tidak dipakai dan namanya tidak ada di Mikrotik. Paket itu yang akan dihapus.`
                      : "Tidak ada paket kosong yang namanya hilang dari Mikrotik."}
                  </p>
                  {result.usedMissing.length > 0 ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                      {result.usedMissing.length} paket masih dipakai pelanggan dan tidak ada di
                      Mikrotik. Paket itu tidak dihapus, tetapi sudah ditandai di daftar.
                    </p>
                  ) : null}
                  {result.placements.some((row) => row.routers.length > 0) ? (
                    <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2">
                      <p className="font-medium text-slate-800">Paket di tiap router</p>
                      <RouterPaketSummary placements={result.placements} />
                    </div>
                  ) : null}
                  {result.failedRouters.length > 0 ? (
                    <p className="text-xs text-slate-500">
                      Router yang tidak terbaca dilewati:{" "}
                      {result.failedRouters.map((router) => router.nama).join(", ")}.
                    </p>
                  ) : null}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <Button color="slatesky" onClick={close} disabled={loading || deleting}>
                  Tutup
                </Button>
                <Button
                  color="red"
                  loading={deleting}
                  disabled={loading || !result || result.deletable.length === 0}
                  onClick={() => void remove()}
                >
                  Hapus
                </Button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
