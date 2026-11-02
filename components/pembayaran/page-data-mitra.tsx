"use client";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { Input } from "../input";
import Pagination from "../pagination";
import Search from "../search";
import TooltipButton from "./tooltip-button";
import { StatusBayar } from "@prisma/client";
import DialogPembayaranMitra from "./dialog-pembayaran-mitra";
import DialogInvoiceMitra from "./dialog-invoice-mitra";
import { MdOutlinePayments } from "react-icons/md";
import TooltipTotalMitra from "./tooltip-total-mitra";
import { FaFileInvoiceDollar } from "react-icons/fa6";
import { useRouter } from "next/navigation";
import { Button } from "../button";
import { useBillingAllowedMonths } from "@/components/billing-period-provider";
import {
  clampBillingMonth,
  defaultBillingMonth,
} from "@/lib/billing-period-policy";
import DialogGenerate from "../header/dialog-generate";
import { triggerGeneratePayments } from "@/lib/server-actions/payment";

function formatIdr(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export type Rekapan = {
  pembayaran: {
    bulan: string;
    total: number;
    ppn: number;
    bhp: number;
    uso: number;
    bersih: number;
    mitra: number;
    bayar: number;
    kantor: number;
    tagihanKantor: number;
    saldo: number;
    status: StatusBayar;
    metode?: string | null;
    bankId?: number | null;
  };
  id: number;
  nama: string;
  user: string;
  ownedByIsp?: boolean;
};

export type PembayaranMitraState = {
  modal: boolean;
  type?: "payment" | "invoice";
  data?: Rekapan;
};

export type PembayaranMitraAction =
  | {
      action: "open";
      data: PembayaranMitraState["data"];
      type?: PembayaranMitraState["type"];
    }
  | { action: "close" }
  | { action: "data"; data: PembayaranMitraState["data"] };

export default function PageData() {
  // const searchParams = useSearchParams();
  // const pathname = usePathname();

  // const bulanParams = searchParams.get("bulan");
  const [bulan, setBulan] = useState<string>("");

  // useEffect(() => {
  //   if (!bulanParams) return;
  //   setBulan(bulanParams);
  // }, [bulanParams]);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMitra, setTotalMitra] = useState(0);
  // const query = searchParams.get("query") || "";
  // const page = parseInt(searchParams.get("page") || "1");

  const pembayaranState = {
    modal: false,
    data: undefined,
  };
  const pembayaranActs = (
    state: PembayaranMitraState,
    action: PembayaranMitraAction
  ) => {
    switch (action.action) {
      case "open": {
        return {
          modal: true,
          data: action.data,
          type: action.type || "payment",
        };
      }
      case "close": {
        return {
          ...state,
          modal: false,
        };
      }
      case "data": {
        return {
          ...state,
          data: action.data,
        };
      }
    }
  };
  const [pembayaranDialog, pembayaranDialogDispatch] = useReducer(
    pembayaranActs,
    pembayaranState
  );

  const [user, setUser] = useState<Rekapan[]>([]);
  const [ppnEnabled, setPpnEnabled] = useState(true);
  const billingAllowed = useBillingAllowedMonths();
  const [mutating, setMutating] = useState<boolean>(true);
  const loadData = useCallback(async (signal?: AbortSignal) => {
    setMutating(true);
    try {
      const params = new URLSearchParams({
        bulan,
        page: String(page),
        limit: "10",
      });
      if (query.trim()) params.set("q", query.trim());
      const resp = await fetch(`/api/pembayaran/mitra?${params.toString()}`, {
        signal: signal,
      });
      const json = await resp.json();
      if (!resp.ok)
        throw new Error(
          json.error || json.message || "Terjadi kesalahan pada server"
        );
      const p = json.pagination;
      let tp = 1;
      let tm = (json.data || []).length;
      if (p && typeof p.totalPages === "number") {
        tp = Math.max(1, p.totalPages);
        tm = typeof p.total === "number" ? p.total : 0;
      }
      setTotalPages(tp);
      setTotalMitra(tm);
      if (page > tp) {
        setPage(tp);
        setMutating(false);
        return;
      }
      setUser(json.data || []);
      setPpnEnabled(json.ppnEnabled !== false);
      setMutating(false);
    } catch (err) {
      const error = err as Error;
      if (error.name === "AbortError") return;
      console.error(error);
      toast.error(error.message);
      setMutating(false);
    }
  }, [bulan, page, query]);

  useEffect(() => {
    if (!bulan) return;
    const controller = new AbortController();
    loadData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [bulan, page, query, loadData]);

  // const ppn = useMemo(
  //   () =>
  //     (parseInt(
  //       bulan.split("-").at(0) || new Date().getFullYear().toString()
  //     ) >= 2025
  //       ? 0.12
  //       : 0.11) * 100,
  //   [bulan]
  // );

  const initialized = useRef<boolean>(false);
  useEffect(() => {
    if (!initialized.current) {
      setBulan(defaultBillingMonth(billingAllowed));
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (!billingAllowed?.length || !bulan) return;
    const next = clampBillingMonth(bulan, billingAllowed);
    if (next !== bulan) setBulan(next);
  }, [billingAllowed, bulan]);

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const { refresh } = useRouter();

  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [mutatingGenerate, setMutatingGenerate] = useState(false);

  const handleGenerate = async () => {
    setMutatingGenerate(true);
    try {
      const res = await triggerGeneratePayments();
      if (!res.success) throw new Error(res.error);
      toast.success(res.message);
      setShowGenerateDialog(false);
      setTimeout(() => {
        void loadData();
        refresh();
      }, 2000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setMutatingGenerate(false);
    }
  };

  const bagianHeader =
    user.length > 0 && user.every((row) => row.ownedByIsp)
      ? "Pendapatan"
      : user.some((row) => row.ownedByIsp)
        ? "Bagian"
        : "Mitra";

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-theme-bg text-slate-700 dark:text-theme-fg">
      <section
        className={cn(
          "flex flex-col gap-4 w-full relative",
          "sm:grid sm:grid-cols-3"
        )}
      >
        <Search
          isSearchParams={false}
          handleSearch={handleSearch}
          queryState={query}
        />
        <p className="flex justify-center font-medium order-first sm:order-none">
          Pembayaran Mitra
        </p>
        <div className="flex h-min justify-end flex-wrap gap-2 items-center sm:justify-end">
          <Input
            type="month"
            className="sm:w-min w-full"
            value={bulan}
            min={billingAllowed?.[0]}
            max={billingAllowed?.[billingAllowed.length - 1]}
            onChange={(e) => {
              setPage(1);
              const next = clampBillingMonth(e.target.value, billingAllowed);
              setBulan(next);
            }}
          />
          <Button
            disabled={mutating}
            type="button"
            onClick={() => setShowGenerateDialog(true)}
            color="sky"
            className="w-full sm:w-auto"
          >
            Generate Tagihan
          </Button>
        </div>
        <p className="absolute -bottom-4 w-full text-[10px]/3 sm:text-xs text-slate-700/90">
          Catatan: Klik pada baris untuk menampilkan menu aksi
        </p>
      </section>
      <section className="flex flex-col gap-3 md:hidden w-full">
        {mutating ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="w-full bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex flex-col gap-3 animate-pulse"
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                <div className="flex flex-col gap-2 w-full">
                  <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
                <div className="flex flex-col items-end gap-1 w-1/4">
                  <div className="h-5 bg-slate-200 rounded w-full"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 bg-slate-200 rounded"></div>
                <div className="h-10 bg-slate-200 rounded"></div>
              </div>
            </div>
          ))
        ) : user && user.length > 0 ? (
          user.map((val, idx) => {
            const numberPage = page <= 1 ? 0 : (page - 1) * 10;
            const nomor = idx + 1 + numberPage;
            return (
              <div
                key={nomor}
                className="w-full bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                  <div className="flex flex-col">
                    <div className="font-bold text-base flex items-center gap-2">
                      <span className="text-slate-500 text-sm">{nomor}.</span>
                      <span>{val.nama}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-col gap-1">
                      <span>User: {val.user}</span>
                      <span>
                        Inv:{" "}
                        {new Date(
                          val.pembayaran.bulan + "-20"
                        ).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        val.pembayaran.status === "Terbayar"
                          ? "bg-green-100 text-green-700"
                          : val.pembayaran.status === "Belum"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {val.pembayaran.status}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Saldo:{" "}
                      {(val.pembayaran.mitra - val.pembayaran.bayar).toLocaleString(
                        "id-ID",
                        {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        }
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-500">Bruto tagihan</span>
                    <span className="font-semibold">
                      {formatIdr(val.pembayaran.total)}
                    </span>
                  </div>
                  <div className="flex flex-col p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-500">
                      {val.ownedByIsp ? "Pendapatan" : "Bagian Mitra"}
                    </span>
                    <span className="font-semibold">
                      {formatIdr(val.pembayaran.mitra)}
                    </span>
                  </div>
                  <div className="flex flex-col p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-500">BHP</span>
                    <span className="font-semibold">
                      {formatIdr(val.pembayaran.bhp ?? 0)}
                    </span>
                  </div>
                  <div className="flex flex-col p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-500">USO</span>
                    <span className="font-semibold">
                      {formatIdr(val.pembayaran.uso ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 bg-sky-50 text-sky-600 py-2 rounded border border-sky-100 hover:bg-sky-100 transition-colors text-sm font-medium"
                    onClick={() =>
                      pembayaranDialogDispatch({
                        action: "open",
                        data: val,
                      })
                    }
                  >
                    <MdOutlinePayments className="size-4" />
                    <span>Bayar</span>
                  </button>
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-50 text-slate-600 py-2 rounded border border-slate-200 hover:bg-slate-100 transition-colors text-sm font-medium"
                    onClick={() =>
                      pembayaranDialogDispatch({
                        action: "open",
                        data: val,
                        type: "invoice",
                      })
                    }
                  >
                    <FaFileInvoiceDollar className="size-4" />
                    <span>Invoice</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500 border border-slate-200 border-dashed">
            <p className="text-sm">Belum ada data</p>
          </div>
        )}
      </section>
      <section
        className={cn(
          "w-full overflow-x-auto rounded text-xs shadow hidden md:block"
        )}
      >
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-2.5 *:py-1">
              <td rowSpan={2} className="px-1">
                No.
              </td>
              <td rowSpan={2}>Nama</td>
              <td rowSpan={2}>User</td>
              <td rowSpan={2}>Tanggal Inv.</td>
              <td rowSpan={2}>Bruto tagihan</td>
              {ppnEnabled ? <td rowSpan={2}>Nett</td> : null}
              {ppnEnabled ? <td rowSpan={2}>PPN</td> : null}
              <td rowSpan={2}>BHP</td>
              <td rowSpan={2}>USO</td>
              <td colSpan={2}>Pembagian Hasil</td>
              <td rowSpan={2}>Total Dibayar</td>
              <td rowSpan={2}>Saldo Tagihan</td>
              <td rowSpan={2}>Status Tagihan</td>
            </tr>
            <tr className="bg-slate-300/70 *:px-2.5 *:py-1 *:border *:border-slate-50">
              <td>Kantor</td>
              <td>{bagianHeader}</td>
            </tr>
          </thead>
          <tbody>
            {mutating ? (
              [...Array(10)].map((_, idx) => (
                <tr className="bg-slate-50/80 hover:text-sky-600" key={idx}>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-4" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-4" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-20" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-20" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-24" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-24" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-16" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-16" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-16" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-20" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-20" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-24" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-24" />
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2">
                    <div className="animate-pulse rounded-sm bg-slate-300/60 h-4 w-12" />
                  </td>
                </tr>
              ))
            ) : user && user.length > 0 ? (
              user.map((val, idx) => {
                const numberPage = page <= 1 ? 0 : (page - 1) * 10;
                const nomor = idx + 1 + numberPage;
                return (
                  <TooltipButton
                    key={nomor}
                    title={
                      <>
                        <button
                          type="button"
                          className="hover:bg-slate-100 flex gap-2 items-center py-1 px-2 rounded"
                          onClick={() =>
                            pembayaranDialogDispatch({
                              action: "open",
                              data: val,
                            })
                          }
                        >
                          <MdOutlinePayments className="size-4" />
                          <p>Bayar</p>
                        </button>
                        <button
                          type="button"
                          className="hover:bg-slate-100 flex gap-2 items-center py-1 px-2 rounded"
                          onClick={() =>
                            pembayaranDialogDispatch({
                              action: "open",
                              data: val,
                              type: "invoice",
                            })
                          }
                        >
                          <FaFileInvoiceDollar className="size-4" />
                          <p>Invoice</p>
                        </button>
                      </>
                    }
                  >
                    <tr
                      className={cn(
                        "bg-slate-50/80 hover:text-slate-700 divide-x divide-y divide-slate-100 cursor-pointer",
                        val.pembayaran.bayar >= val.pembayaran.tagihanKantor
                          ? "text-green-500"
                          : val.pembayaran.bayar === 0
                          ? "text-red-500"
                          : "text-amber-400"
                      )}
                      key={idx}
                    >
                      <td className="whitespace-pre-wrap px-1 py-2 text-center">
                        {nomor + "."}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {val.nama}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {val.user}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {(() => {
                          if (!bulan) return "";
                          const date = new Date(bulan);
                          if (isNaN(date.getTime())) return "";
                          date.setDate(10);
                          return new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "short",
                          }).format(date);
                        })()}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {val.pembayaran.total.toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      {ppnEnabled ? (
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {val.pembayaran.bersih.toLocaleString("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          })}
                        </td>
                      ) : null}
                      {ppnEnabled ? (
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {formatIdr(val.pembayaran.ppn)}
                        </td>
                      ) : null}
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {formatIdr(val.pembayaran.bhp ?? 0)}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {formatIdr(val.pembayaran.uso ?? 0)}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {formatIdr(val.pembayaran.kantor)}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {formatIdr(val.pembayaran.mitra)}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {formatIdr(val.pembayaran.bayar)}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {formatIdr(val.pembayaran.saldo)}
                      </td>
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {val.pembayaran.kantor === 0
                          ? "Terbayar"
                          : val.pembayaran.status}
                      </td>
                    </tr>
                  </TooltipButton>
                );
              })
            ) : (
              <tr className="bg-slate-50/80">
                <td colSpan={99}>
                  <p className="px-4 py-2 text-center">Tidak ada data</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <DialogPembayaranMitra
        loadData={loadData}
        state={pembayaranDialog}
        dispatch={pembayaranDialogDispatch}
        bulan={bulan}
      />
      <DialogInvoiceMitra
        state={pembayaranDialog}
        dispatch={pembayaranDialogDispatch}
        bulan={bulan}
        ppnEnabled={ppnEnabled}
      />
      <DialogGenerate
        isOpen={showGenerateDialog}
        close={() => setShowGenerateDialog(false)}
        onConfirm={handleGenerate}
        mutating={mutatingGenerate}
      />
      <Pagination
        isSearchParams={false}
        onChange={setPage}
        pageState={page}
        totalPagesState={totalPages}
      />

      <TooltipTotalMitra
        rekapan={user}
        partialTotals={totalMitra > user.length}
      />
    </div>
  );
}
