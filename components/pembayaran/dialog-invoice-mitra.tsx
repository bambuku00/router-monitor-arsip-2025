import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { PembayaranMitraAction, PembayaranMitraState } from "./page-data-mitra";
import { IoPrintOutline, IoClose } from "react-icons/io5";
import toast from "react-hot-toast";

type Bank = {
  id: number;
  bank: string;
  norek: string;
  nama: string;
  hideFromUnpaidInvoice?: boolean;
};

type Props = {
  state: PembayaranMitraState;
  dispatch: React.Dispatch<PembayaranMitraAction>;
  bulan: string;
  ppnEnabled?: boolean;
};

export default function DialogInvoiceMitra({
  state,
  dispatch,
  bulan,
  ppnEnabled = true,
}: Props) {
  const show = useMemo(() => {
    return state.modal && state.type === "invoice";
  }, [state]);

  const close = () => {
    dispatch({ action: "close" });
    setTimeout(() => {
      dispatch({ action: "data", data: undefined });
    }, 300);
  };

  const val = useMemo(() => state.data, [state]);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const invoiceBanks = useMemo(() => {
    if (val?.pembayaran.status === "Terbayar") return banks;
    return banks.filter((bank) => bank.hideFromUnpaidInvoice !== true);
  }, [banks, val?.pembayaran.status]);

  useEffect(() => {
    if (show && banks.length === 0) {
      setLoadingBanks(true);
      fetch("/api/bank?role=Superadmin")
        .then((res) => res.json())
        .then((json) => {
          if (json.data) setBanks(json.data);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingBanks(false));
    }
  }, [show, banks.length]);

  const documentTitle = useMemo(() => {
    if (!val || !val.pembayaran) return "Invoice";
    const dateStr = val.pembayaran.bulan || bulan;
    return `Invoice-${val.nama}-${dateStr}`;
  }, [val, bulan]);

  const formatDate = (dateString?: string) => {
    const targetDate = dateString || bulan;
    if (!targetDate) return "-";
    const parts = targetDate.split("-");
    if (parts.length < 2) return targetDate;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
    const date = new Date(year, month, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  };
  
  const formatFullDate = (dateString?: string, day: number = 1) => {
      const targetDate = dateString || bulan;
      if (!targetDate) return "-";
      const parts = targetDate.split("-");
      if (parts.length < 2) return targetDate;
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const date = new Date(year, month, day);
      return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: documentTitle,
  });

  /** Unduh PDF via dialog cetak browser (Save as PDF) — tanpa html2pdf/jspdf. */
  const handleDownloadPdf = () => {
    toast("Pilih printer “Microsoft Print to PDF” / “Save as PDF” di dialog cetak");
    handlePrint();
  };

  return (
    <Transition appear show={show}>
      <Dialog
        as="div"
        className="relative z-50 focus:outline-none"
        onClose={close}
      >
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              enter="ease-out duration-300"
              enterFrom="opacity-0 transform-[scale(95%)]"
              enterTo="opacity-100 transform-[scale(100%)]"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 transform-[scale(100%)]"
              leaveTo="opacity-0 transform-[scale(95%)]"
            >
              <DialogPanel className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl backdrop-blur-2xl flex flex-col gap-6">
                {!val || !val.pembayaran ? (
                  <div className="text-center p-4">Data tidak tersedia</div>
                ) : (
                  <>
                    <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="text-xl font-bold text-slate-900">
                    Invoice Tagihan
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownloadPdf}
                      className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      <IoPrintOutline className="text-lg" />
                      <span>Cetak / Simpan PDF</span>
                    </Button>
                    <button
                      onClick={close}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                      <IoClose className="text-xl text-slate-500" />
                    </button>
                  </div>
                </div>

                {/* Printable Area */}
                <div className="overflow-auto bg-white p-4" ref={contentRef}>
                  <div className="flex flex-col gap-8 text-slate-800 p-8 border border-slate-200 rounded-lg min-w-[700px]">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold text-sky-700">INVOICE</h1>
                        <p className="text-sm text-slate-500 font-medium">
                          #{val.id}/{(val.pembayaran.bulan || bulan)?.replace("-", "")}/INV
                        </p>
                      </div>
                      <div className="text-right">
                        <h2 className="font-bold text-lg text-red-600">WINET</h2>
                        <p className="text-sm text-slate-600">
                          PT WAHYU ADIDAYA NETWORK
                        </p>
                        <p className="text-sm text-slate-600">
                          Support: +62 812-3456-7890
                        </p>
                      </div>
                    </div>

                    <hr className="border-slate-200" />

                    {/* Info Section */}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                          Ditagihkan Kepada:
                        </p>
                        <div className="font-medium">
                          <p className="text-lg text-slate-900">{val.nama}</p>
                          <p className="text-slate-600">User: {val.user}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 text-right">
                        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                          Periode Tagihan:
                        </p>
                        <div className="font-medium">
                          <p className="text-lg text-slate-900">
                            {formatDate(val.pembayaran.bulan)}
                          </p>
                          <p className="text-slate-600">
                            Jatuh Tempo: {formatFullDate(val.pembayaran.bulan, 20)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="mt-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-y border-slate-200">
                            <th className="py-3 px-4 text-left font-semibold">Deskripsi</th>
                            <th className="py-3 px-4 text-right font-semibold">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="py-3 px-4 text-slate-500">
                              Bruto tagihan bulanan
                            </td>
                            <td className="py-3 px-4 text-right text-slate-500">
                              {val.pembayaran.total.toLocaleString("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                              })}
                            </td>
                          </tr>
                          {ppnEnabled ? (
                            <tr>
                              <td className="py-3 px-4 font-medium">
                                Pendapatan Bersih (Nett)
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                {val.pembayaran.bersih.toLocaleString("id-ID", {
                                  style: "currency",
                                  currency: "IDR",
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                            </tr>
                          ) : null}
                          {ppnEnabled ? (
                            <tr>
                              <td className="py-3 px-4">
                                {val.ownedByIsp
                                  ? "PPN"
                                  : "PPN (sesuai profil mitra)"}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-700">
                                +{" "}
                                {val.pembayaran.ppn.toLocaleString("id-ID", {
                                  style: "currency",
                                  currency: "IDR",
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                            </tr>
                          ) : null}
                          <tr>
                            <td className="py-3 px-4">BHP</td>
                            <td className="py-3 px-4 text-right text-slate-700">
                              + {(val.pembayaran.bhp ?? 0).toLocaleString("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                              })}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4">USO</td>
                            <td className="py-3 px-4 text-right text-slate-700">
                              + {(val.pembayaran.uso ?? 0).toLocaleString("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                              })}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4">
                              {val.ownedByIsp ? "Pendapatan" : "Bagian Mitra"}
                            </td>
                            <td className="py-3 px-4 text-right text-red-500">
                              - {val.pembayaran.mitra.toLocaleString("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                              })}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                          <tr>
                            <td className="py-4 px-4">
                              {ppnEnabled
                                ? "Total Tagihan (Kantor + PPN + BHP + USO)"
                                : "Total Tagihan (Kantor + BHP + USO)"}
                            </td>
                            <td className="py-4 px-4 text-right text-lg">
                              {val.pembayaran.tagihanKantor.toLocaleString("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                              })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Status & Payment Info */}
                    <div className="grid grid-cols-2 gap-8 mt-4 pt-4 border-t border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-400 mb-2">
                          Status Pembayaran
                        </p>
                        <span
                          className={cn(
                            "inline-block text-sm font-bold uppercase",
                            val.pembayaran.status === "Terbayar"
                              ? "text-emerald-600"
                              : val.pembayaran.status === "Belum"
                              ? "text-amber-600"
                              : "text-rose-600"
                          )}
                        >
                          {val.pembayaran.status}
                        </span>
                        {val.pembayaran.status !== "Terbayar" && (
                          <div className="mt-3 text-sm text-slate-600">
                            <p>Sisa Tagihan:</p>
                            <p className="text-lg font-bold text-slate-900">
                              {val.pembayaran.saldo.toLocaleString(
                                "id-ID",
                                {
                                  style: "currency",
                                  currency: "IDR",
                                  maximumFractionDigits: 0,
                                }
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-400 mb-1">
                          Metode Pembayaran
                        </p>
                        {loadingBanks ? (
                           <p className="text-sm text-slate-500">Memuat info bank...</p>
                        ) : invoiceBanks.length > 0 ? (
                           invoiceBanks.map((bank) => (
                             <div key={bank.id} className="mb-2 last:mb-0">
                               <p className="text-sm text-slate-600">
                                 Transfer {bank.bank}
                               </p>
                               <p className="font-medium text-slate-900">
                                 {bank.norek}
                               </p>
                               <p className="text-sm text-slate-600">
                                 a.n. {bank.nama}
                               </p>
                             </div>
                           ))
                        ) : (
                           <p className="text-sm text-slate-500 italic">
                             Belum ada info rekening
                           </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-8 text-center text-xs text-slate-400">
                      <p>Terima kasih atas kerjasamanya.</p>
                      <p>Dokumen ini dibuat secara otomatis oleh sistem.</p>
                    </div>
                  </div>
                </div>
                  </>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
