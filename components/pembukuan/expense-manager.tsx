"use client";

import { useCallback, useState, useEffect, Fragment } from "react";
import {
  getPengeluaranList,
  createPengeluaran,
  updatePengeluaran,
  deletePengeluaran,
} from "@/lib/server-actions/pengeluaran/actions";
import { Button } from "@/components/button";
import Pagination from "@/components/pagination";
import Search from "@/components/search";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Tooltip } from "@mui/material";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TbEdit, TbLoader, TbPlus, TbTrash } from "react-icons/tb";

type Pengeluaran = {
  id: number;
  keterangan: string;
  nominal: number;
  tanggal: Date;
  created: Date;
  updated: Date;
};

export default function ExpenseManager({
  onUpdate,
  year,
  month,
  userId,
  komisiNominal = 0,
}: {
  onUpdate?: () => void;
  year?: number;
  month?: number;
  userId?: number;
  komisiNominal?: number;
}) {
  const [data, setData] = useState<Pengeluaran[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");

  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Pengeluaran | null>(null);
  const [displayNominal, setDisplayNominal] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPengeluaranList(
        page,
        pageSize,
        query,
        year,
        month,
        userId
      );
      if ("error" in res && res.error) {
        toast.error(res.error);
        setData([]);
        setTotal(0);
      } else if (res.data) {
        setData(res.data);
        setTotal(res.total);
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengambil data");
    }
    setLoading(false);
  }, [page, pageSize, query, year, month, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [query, year, month]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<{
    keterangan: string;
    nominal: number;
    tanggal: string;
  }>();

  useEffect(() => {
    register("nominal", { required: "Nominal wajib diisi", min: 1 });
  }, [register]);

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const handleNominalChange = (value: string) => {
    const numericString = value.replace(/\D/g, "");
    const numberValue = Number(numericString);

    if (numericString === "") {
      setDisplayNominal("");
      setValue("nominal", 0);
    } else {
      setDisplayNominal(new Intl.NumberFormat("id-ID").format(numberValue));
      setValue("nominal", numberValue);
    }
  };

  const openAdd = () => {
    setSelectedItem(null);
    reset({
      keterangan: "",
      nominal: 0,
      tanggal: new Date().toISOString().split("T")[0],
    });
    setDisplayNominal("");
    setIsOpen(true);
  };

  const openEdit = (item: Pengeluaran) => {
    setSelectedItem(item);
    setValue("keterangan", item.keterangan);
    setValue("nominal", item.nominal);
    setValue("tanggal", new Date(item.tanggal).toISOString().split("T")[0]);
    setDisplayNominal(new Intl.NumberFormat("id-ID").format(item.nominal));
    setIsOpen(true);
  };

  const openDelete = (item: Pengeluaran) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const onSubmit = async (formData: {
    keterangan: string;
    nominal: number;
    tanggal: string;
  }) => {
    const payload = {
      keterangan: formData.keterangan,
      nominal: formData.nominal,
      tanggal: new Date(formData.tanggal),
    };
    const res = selectedItem
      ? await updatePengeluaran(selectedItem.id, payload)
      : await createPengeluaran({
          ...payload,
          ...(userId ? { userId } : {}),
        });

    if (res.success) {
      toast.success(
        selectedItem ? "Berhasil mengupdate pengeluaran" : "Berhasil menambah pengeluaran"
      );
      setIsOpen(false);
      fetchData();
      if (onUpdate) onUpdate();
    } else {
      toast.error(res.error || "Terjadi kesalahan");
    }
  };

  const onDelete = async () => {
    if (!selectedItem) return;
    const res = await deletePengeluaran(selectedItem.id);
    if (res.success) {
      toast.success("Berhasil menghapus pengeluaran");
      setIsDeleteOpen(false);
      fetchData();
      if (onUpdate) onUpdate();
    } else {
      toast.error(res.error || "Terjadi kesalahan");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const komisiVisible =
    komisiNominal !== 0 &&
    (!query.trim() || "komisi petugas".includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-4 w-full">
      <section className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-4 w-full">
        <div className="order-2 md:order-none w-full min-w-0 [&>div]:max-w-none [&>div]:w-full">
          <Search
            isSearchParams={false}
            queryState={query}
            handleSearch={handleSearch}
          />
        </div>
        <p className="flex justify-center font-medium items-center order-1 md:order-none">
          Daftar Pengeluaran
        </p>
        <Button
          onClick={openAdd}
          color="slatesky"
          className="order-3 md:order-none w-full md:w-min md:justify-self-end flex items-center justify-center gap-1 text-xs py-1.5 px-2"
        >
          <TbPlus className="size-4" />
          Tambah
        </Button>
      </section>

      <section
        className={cn(
          "w-full overflow-x-auto rounded text-sm shadow hidden md:block"
        )}
      >
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 dark:divide-theme-border/50 bg-slate-300/70 *:px-4 *:py-2">
              <td>No.</td>
              <td>Tanggal</td>
              <td>Keterangan</td>
              <td className="text-right">Nominal</td>
              <td className="text-center">*</td>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={5}>
                  <p className="px-4 py-2 text-center">
                    <TbLoader className="animate-spin inline mr-2" />
                    Memuat...
                  </p>
                </td>
              </tr>
            ) : data.length === 0 && !komisiVisible ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={5}>
                  <p className="px-4 py-2 text-center">
                    Tidak ada data pengeluaran
                  </p>
                </td>
              </tr>
            ) : (
              <>
              {komisiVisible ? (
                <tr className="bg-slate-50/80 dark:bg-theme-card/30 divide-x divide-y divide-slate-100 dark:divide-theme-border/40">
                  <td className="whitespace-pre-wrap px-4 py-2">—</td>
                  <td className="whitespace-pre-wrap px-4 py-2">Periode ini</td>
                  <td className="whitespace-pre-wrap px-4 py-2">Komisi petugas</td>
                  <td className="whitespace-pre-wrap px-4 py-2 text-right font-medium tabular-nums">
                    {formatCurrency(komisiNominal)}
                  </td>
                  <td className="whitespace-pre-wrap px-4 py-2 text-center text-xs text-slate-500">
                    Otomatis
                  </td>
                </tr>
              ) : null}
              {data.map((item, idx) => {
                const nomor = (page - 1) * pageSize + idx + 1;
                return (
                  <tr
                    key={item.id}
                    className="bg-slate-50/80 dark:bg-theme-card/30 hover:text-sky-600 divide-x divide-y divide-slate-100 dark:divide-theme-border/40"
                  >
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {nomor + "."}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {new Date(item.tanggal).toLocaleDateString("id-ID")}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {item.keterangan}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(item.nominal)}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <div className="flex gap-2 justify-center">
                        <Tooltip title="Edit">
                          <Button
                            color="slatesky"
                            className="rounded py-0.5"
                            onClick={() => openEdit(item)}
                          >
                            <TbEdit className="size-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip title="Hapus">
                          <Button
                            color="slatesky"
                            className="rounded py-0.5"
                            onClick={() => openDelete(item)}
                          >
                            <TbTrash className="size-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </>
            )}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3 md:hidden w-full">
        {loading ? (
          <div className="bg-slate-50 dark:bg-theme-card rounded-lg p-8 text-center text-slate-500 border border-slate-200 dark:border-theme-border border-dashed">
            <p className="text-sm">
              <TbLoader className="animate-spin inline mr-2" />
              Memuat...
            </p>
          </div>
        ) : data.length === 0 && !komisiVisible ? (
          <div className="bg-slate-50 dark:bg-theme-card rounded-lg p-8 text-center text-slate-500 border border-slate-200 dark:border-theme-border border-dashed">
            <p className="text-sm">Tidak ada data pengeluaran</p>
          </div>
        ) : (
          <>
          {komisiVisible ? (
            <div className="w-full bg-white dark:bg-theme-card rounded-lg shadow-sm border border-slate-200 dark:border-theme-border p-3 flex justify-between items-start gap-3">
              <div className="flex flex-col min-w-0">
                <p className="font-bold text-base">Komisi petugas</p>
                <span className="text-xs text-slate-500 mt-1">Periode ini · Otomatis</span>
              </div>
              <p className="text-sm font-bold tabular-nums shrink-0">
                {formatCurrency(komisiNominal)}
              </p>
            </div>
          ) : null}
          {data.map((item, idx) => {
            const nomor = (page - 1) * pageSize + idx + 1;
            return (
              <div
                key={item.id}
                className="w-full bg-white dark:bg-theme-card rounded-lg shadow-sm border border-slate-200 dark:border-theme-border p-3 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-theme-border pb-2">
                  <div className="flex flex-col min-w-0">
                    <div className="font-bold text-base flex items-center gap-2">
                      <span className="text-slate-500 text-sm">{nomor}.</span>
                      <span className="truncate">{item.keterangan}</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">
                      {new Date(item.tanggal).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-bold tabular-nums shrink-0 ml-2">
                    {formatCurrency(item.nominal)}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    color="slatesky"
                    className="rounded py-0.5"
                    onClick={() => openEdit(item)}
                  >
                    <TbEdit className="size-4" />
                  </Button>
                  <Button
                    color="slatesky"
                    className="rounded py-0.5"
                    onClick={() => openDelete(item)}
                  >
                    <TbTrash className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          </>
        )}
      </section>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-theme-fg-muted">
          <span>Tampilkan</span>
          <select
            className="bg-slate-200/80 dark:bg-theme-elevated border-none rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>data</span>
        </div>
        <Pagination
          isSearchParams={false}
          pageState={page}
          totalPagesState={totalPages}
          onChange={(val) => setPage(val)}
        />
      </div>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-theme-card p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-theme-fg mb-4"
                  >
                    {selectedItem ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
                  </DialogTitle>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-theme-fg mb-1">
                        Tanggal
                      </label>
                      <input
                        type="date"
                        {...register("tanggal", { required: "Tanggal wajib diisi" })}
                        className="w-full rounded border border-slate-300 dark:border-theme-border dark:bg-theme-elevated dark:text-theme-fg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      {errors.tanggal && (
                        <span className="text-xs text-red-500">
                          {errors.tanggal.message as string}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-theme-fg mb-1">
                        Keterangan
                      </label>
                      <input
                        type="text"
                        {...register("keterangan", {
                          required: "Keterangan wajib diisi",
                        })}
                        className="w-full rounded border border-slate-300 dark:border-theme-border dark:bg-theme-elevated dark:text-theme-fg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="Contoh: Bayar Listrik"
                      />
                      {errors.keterangan && (
                        <span className="text-xs text-red-500">
                          {errors.keterangan.message as string}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-theme-fg mb-1">
                        Nominal (Rp)
                      </label>
                      <input
                        type="text"
                        value={displayNominal}
                        onChange={(e) => handleNominalChange(e.target.value)}
                        className="w-full rounded border border-slate-300 dark:border-theme-border dark:bg-theme-elevated dark:text-theme-fg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="0"
                      />
                      {errors.nominal && (
                        <span className="text-xs text-red-500">
                          {errors.nominal.message as string}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                      <Button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        color="red100"
                        className="px-4"
                      >
                        Batal
                      </Button>
                      <Button type="submit" loading={isSubmitting} className="px-4">
                        Simpan
                      </Button>
                    </div>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isDeleteOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteOpen(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-theme-card p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-theme-fg mb-2"
                  >
                    Hapus Pengeluaran?
                  </DialogTitle>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-theme-fg-muted">
                      Apakah Anda yakin ingin menghapus pengeluaran &quot;
                      {selectedItem?.keterangan}&quot; senilai{" "}
                      {selectedItem && formatCurrency(selectedItem.nominal)}?
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <Button
                      type="button"
                      onClick={() => setIsDeleteOpen(false)}
                      color="amber100"
                      className="px-4"
                    >
                      Batal
                    </Button>
                    <Button type="button" onClick={onDelete} color="red" className="px-4">
                      Hapus
                    </Button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
