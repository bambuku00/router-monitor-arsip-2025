import { Button } from "@/components/button";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import type { Paket } from "@prisma/client";
import React from "react";
import { TbUserPlus } from "react-icons/tb";

type Props = {
  isOpen: boolean;
  close: () => void;
  onConfirm: (defaultPaketId: number | null) => void;
  mutating: boolean;
  count: number;
  pakets: Paket[];
};

export default function DialogBulkFillPelanggan({
  isOpen,
  close,
  onConfirm,
  mutating,
  count,
  pakets,
}: Props) {
  const [defaultPaketId, setDefaultPaketId] = React.useState<number | "">(
    pakets[0]?.id ?? ""
  );

  React.useEffect(() => {
    if (isOpen) setDefaultPaketId(pakets[0]?.id ?? "");
  }, [isOpen, pakets]);

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
                  <TbUserPlus className="size-6 text-sky-600" />
                  Isi Data Pelanggan
                </DialogTitle>
                <div className="mt-2 space-y-3 text-sm text-gray-600">
                  <p>
                    Mengisi otomatis data pelanggan untuk{" "}
                    <strong>{count.toLocaleString("id-ID")}</strong> PPP yang
                    belum terdaftar pada router ini.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                    <li>Nama diambil dari username PPP (atau komentar jika ada)</li>
                    <li>
                      Paket dicocokkan exact match dengan nama profil PPP (trim,
                      tidak membedakan huruf besar/kecil)
                    </li>
                    <li>
                      Jika profil tidak cocok: satu paket berbayar dapat dipakai
                      fallback; paket Rp0 tidak pernah fallback otomatis
                    </li>
                    {pakets.length > 1 ? (
                      <li>
                        Jika ada beberapa paket, pilih paket default di bawah
                        hanya untuk PPP yang profilnya tidak cocok
                      </li>
                    ) : null}
                    <li>
                      Tanggal berlangganan mengikuti tanggal PPP diambil ke
                      sistem
                    </li>
                    <li>Alamat/nomor diisi sementara &quot;-&quot; — bisa diedit
                      per pelanggan nanti</li>
                  </ul>
                  {pakets.length > 1 ? (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-800">
                        Paket default (jika profil tidak cocok)
                      </span>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm"
                        value={defaultPaketId}
                        onChange={(e) =>
                          setDefaultPaketId(
                            e.target.value ? parseInt(e.target.value, 10) : ""
                          )
                        }
                        disabled={mutating}
                      >
                        {pakets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nama}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                    onClick={() =>
                      onConfirm(
                        typeof defaultPaketId === "number"
                          ? defaultPaketId
                          : pakets[0]?.id ?? null
                      )
                    }
                    disabled={mutating || pakets.length === 0}
                    loading={mutating}
                  >
                    Isi Sekarang
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
