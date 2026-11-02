"use client";

import { Button } from "@/components/button";
import { EditAction, EditState } from "@/lib/paket-types";
import { formatKapasitasMbps } from "@/lib/mikrotik-paket";
import { nominalPaketForDisplay } from "@/lib/paket-persist";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Paket, Router, User } from "@prisma/client";
import Fuse from "fuse.js";
import { User as UserLucia } from "lucia";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import toast from "react-hot-toast";
import { TbEdit, TbTrash } from "react-icons/tb";
import Pagination from "../pagination";
import Search from "../search";
import DeleteMissingMikrotik, {
  type PaketRouterPlacement,
} from "./delete-missing-mikrotik";
import DialogData from "./dialog-data";
import SyncPaketMikrotik from "./sync-mikrotik";

function placementMap(
  rows:
    | {
        id: number;
        nama: string;
        routerLinks?: { router: { nama: string } }[];
      }[]
    | undefined
) {
  const map = new Map<number, PaketRouterPlacement>();
  for (const row of rows ?? []) {
    const routers = (row.routerLinks ?? [])
      .map((link) => link.router.nama)
      .filter(Boolean);
    if (routers.length === 0) continue;
    map.set(row.id, {
      id: row.id,
      nama: row.nama,
      routers,
      unchecked: false,
    });
  }
  return map;
}

function paketRouterText(placement?: PaketRouterPlacement) {
  if (!placement) return "—";
  if (placement.unchecked) return "Belum lengkap";
  if (placement.routers.length === 0) return "Tidak ada";
  return placement.routers.join(", ");
}

function MissingOnMikrotikMark() {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      Dipakai, tidak ada di Mikrotik
    </span>
  );
}

export default function Data({
  paket,
  user,
  routers,
}: {
  paket:
    | (Paket & {
        user?: Pick<User, "nama">;
        pelanggan?: { id: number }[];
        routerLinks?: { router: { nama: string } }[];
      })[]
    | undefined;
  user?: UserLucia;
  routers: Pick<Router, "id" | "nama" | "host">[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(
    Math.ceil((paket?.length || 1) / 10)
  );

  const [add, setAdd] = useState<boolean>(false);
  const [missingUsedIds, setMissingUsedIds] = useState<number[]>([]);
  const [routerByPaket, setRouterByPaket] = useState<
    Map<number, PaketRouterPlacement>
  >(() => placementMap(paket));
  useEffect(() => {
    setRouterByPaket(placementMap(paket));
  }, [paket]);
  const [routerFilter, setRouterFilter] = useState("");

  const editState = {
    modal: false,
    data: undefined,
  };
  const editActs = (state: EditState, action: EditAction) => {
    switch (action.action) {
      case "open": {
        return {
          modal: true,
          data: action.data,
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
  const [edit, editDispatch] = useReducer(editActs, editState);

  const [deleteNotAllowed, setDeleteNotAllowed] = useState<boolean>(false);
  const hapusState = {
    modal: false,
    data: undefined,
  };
  const hapusActs = (state: EditState, action: EditAction) => {
    switch (action.action) {
      case "open": {
        return {
          modal: true,
          data: action.data,
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
  const [hapus, hapusDispatch] = useReducer(hapusActs, hapusState);

  const ppnPercent = user?.ppn ?? 11;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(paket || [], {
        keys: ["nama", "user.nama", "harga", "kapasitas"],
        threshold: 0.3,
      }),
    [paket]
  );

  const routerOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of routerByPaket.values()) {
      for (const name of row.routers) names.add(name);
    }
    return [...names];
  }, [routerByPaket]);

  const filteredPaket = useMemo(() => {
    const searched =
      query === "" ? paket : fuse.search(query).map((val) => val.item);
    const data = (searched || []).filter((row) => {
      if (!routerFilter) return true;
      const placement = routerByPaket.get(row.id);
      if (!placement || placement.unchecked) return false;
      if (routerFilter === "__none__") return placement.routers.length === 0;
      return placement.routers.includes(routerFilter);
    });
    const totalPagesParsed = Math.max(1, Math.ceil(data.length / pageSize));
    setTotalPages(totalPagesParsed);
    const safePage = Math.min(page, totalPagesParsed);
    return data.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [paket, page, pageSize, query, fuse, routerFilter, routerByPaket]);

  return (
    <>
      <section className="grid grid-cols-3 gap-4 w-full relative">
        <Search
          isSearchParams={false}
          queryState={query}
          handleSearch={handleSearch}
        />
        <p className="flex justify-center font-medium">Paket List</p>
        <div className="flex gap-1.5 justify-self-end items-center">
          <SyncPaketMikrotik routers={routers} />
          {routerOptions.length > 0 ? (
            <select
              aria-label="Filter router"
              className="max-w-36 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700"
              value={routerFilter}
              onChange={(event) => {
                setPage(1);
                setRouterFilter(event.target.value);
              }}
            >
              <option value="">Semua router</option>
              {routerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__none__">Tidak ada di router</option>
            </select>
          ) : null}
          <DeleteMissingMikrotik
            onUsedMissing={setMissingUsedIds}
            onPlacements={(rows) => {
              setPage(1);
              setRouterByPaket(new Map(rows.map((row) => [row.id, row])));
            }}
          />
        </div>
      </section>
      <section className={cn("w-full overflow-x-auto rounded text-sm shadow hidden md:block")}>
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2">
              <td>No.</td>
              {user?.role === "Superadmin" ? <td>Nama User</td> : null}
              <td>Nama</td>
              <td>Router</td>
              <td>Kapasitas</td>
              <td>Harga</td>
              <td>Total</td>
              <td>Pelanggan</td>
              <td>Tgl. Input</td>
              <td className="text-center">*</td>
            </tr>
          </thead>
          <tbody>
            {filteredPaket && filteredPaket.length > 0 ? (
              filteredPaket.map((val, idx) => {
                const numberPage = page <= 1 ? 0 : (page - 1) * pageSize;
                const nomor = idx + 1 + numberPage;
                return (
                  <tr className="bg-slate-50/80 hover:text-sky-600" key={idx}>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {nomor + "."}
                    </td>
                    {user?.role === "Superadmin" ? (
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {val.user?.nama || "Superadmin"}
                      </td>
                    ) : null}
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {val.nama}
                        {missingUsedIds.includes(val.id) ? <MissingOnMikrotikMark /> : null}
                      </span>
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2 text-slate-600">
                      {paketRouterText(routerByPaket.get(val.id))}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {formatKapasitasMbps(val.kapasitas)}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.harga.toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {nominalPaketForDisplay(val, ppnPercent).toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.pelanggan?.length || 0}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {new Date(val.created!).toLocaleDateString("id-ID")}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <div className="flex gap-2 justify-center">
                        <Button
                          color="slatesky"
                          className="rounded"
                          onClick={() =>
                            editDispatch({
                              action: "open",
                              data: val,
                            })
                          }
                        >
                          <TbEdit />
                        </Button>
                        <Button
                          color="slatesky"
                          className="rounded"
                          onClick={() => {
                            if (val.pelanggan?.length || 0 > 0)
                              return setDeleteNotAllowed(true);
                            hapusDispatch({
                              action: "open",
                              data: val,
                            });
                          }}
                        >
                          <TbTrash />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-slate-50/80">
                <td colSpan={7}>
                  <p className="px-4 py-2 text-center">Belum ada data</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section className="flex flex-col gap-3 md:hidden w-full">
        {filteredPaket && filteredPaket.length > 0 ? (
          filteredPaket.map((val, idx) => {
            const numberPage = page <= 1 ? 0 : (page - 1) * pageSize;
            const nomor = idx + 1 + numberPage;
            return (
              <div
                key={idx}
                className="w-full bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                  <div className="flex flex-col">
                    <div className="font-bold text-base flex flex-wrap items-center gap-2">
                      <span className="text-slate-500 text-sm">{nomor}.</span>
                      <span>{val.nama}</span>
                      {missingUsedIds.includes(val.id) ? <MissingOnMikrotikMark /> : null}
                    </div>
                    {user?.role === "Superadmin" && (
                      <span className="text-xs text-slate-500 mt-0.5">
                        User: {val.user?.nama || "Superadmin"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      color="slatesky"
                      className="rounded"
                      onClick={() =>
                        editDispatch({
                          action: "open",
                          data: val,
                        })
                      }
                    >
                      <TbEdit className="size-4" />
                    </Button>
                    <Button
                      color="slatesky"
                      className="rounded"
                      onClick={() => {
                        if (val.pelanggan?.length || 0 > 0)
                          return setDeleteNotAllowed(true);
                        hapusDispatch({
                          action: "open",
                          data: val,
                        });
                      }}
                    >
                      <TbTrash className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                  <div className="col-span-2">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Router
                    </span>
                    <span className="text-slate-700">
                      {paketRouterText(routerByPaket.get(val.id))}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Kapasitas
                    </span>
                    <span className="text-slate-700">
                      {formatKapasitasMbps(val.kapasitas)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Pelanggan
                    </span>
                    <span className="text-slate-700">
                      {val.pelanggan?.length || 0}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Harga
                    </span>
                    <span className="text-slate-700">
                      {val.harga.toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Total (Inc. PPN)
                    </span>
                    <span className="text-slate-700 font-medium">
                      {nominalPaketForDisplay(val, ppnPercent).toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>

                  <div className="col-span-2 text-xs text-slate-500 mt-1 pt-2 border-t border-slate-50 flex items-center gap-1">
                    <span className="text-slate-400">Tgl. Input:</span>
                    {new Date(val.created!).toLocaleDateString("id-ID")}
                  </div>
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
      <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-2 w-full">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-theme-fg-muted">
          <span>Tampilkan</span>
          <select
            className="rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card py-1.5 px-3 text-sm text-slate-800 dark:text-theme-fg focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            aria-label="Jumlah baris per halaman"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
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
      <DialogData
        add={add}
        setAdd={setAdd}
        edit={edit}
        editDispatch={editDispatch}
        userId={user?.id}
        ppn={user?.ppn}
      />
      <DialogHapus hapus={hapus} hapusDispatch={hapusDispatch} />
      <DialogCantHapus
        deleteNotAllowed={deleteNotAllowed}
        setDeleteNotAllowed={setDeleteNotAllowed}
      />
    </>
  );
}

const DialogCantHapus = ({
  deleteNotAllowed,
  setDeleteNotAllowed,
}: {
  deleteNotAllowed: boolean;
  setDeleteNotAllowed: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <Dialog
      open={deleteNotAllowed}
      as="div"
      className="relative z-[1001]"
      onClose={() => setDeleteNotAllowed(false)}
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
              Paket tidak dapat dihapus
            </DialogTitle>
            <p className="mt-2 text-sm/6">
              Terdapat data pelanggan yang terhubung. Silahkan ganti paket pada
              data pelanggan terlebih dahulu sebelum menghapus paket ini.
            </p>
            <div className="mt-4 text-end">
              <Button
                color="slatesky"
                onClick={() => setDeleteNotAllowed(false)}
              >
                Paham
              </Button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};

const DialogHapus = ({
  hapus,
  hapusDispatch,
}: {
  hapus: EditState;
  hapusDispatch: React.Dispatch<EditAction>;
}) => {
  const { refresh } = useRouter();
  const [mutatingHapus, setMutatingHapus] = useState<boolean>(false);
  const hapusHandler = async () => {
    setMutatingHapus(true);
    try {
      const post = await fetch(`/api/paket/${hapus.data?.id}`, {
        method: "DELETE",
      });
      const resp = await post.json();
      if (!resp.data?.id) throw new Error(resp);
      toast.success(resp.message);
      hapusDispatch({ action: "close" });
      refresh();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
      // Error already shown to user via toast
    } finally {
      setMutatingHapus(false);
    }
  };

  return (
    <Dialog
      open={hapus.modal}
      as="div"
      className="relative z-[1001]"
      onClose={() => hapusDispatch({ action: "close" })}
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
              Hapus paket
            </DialogTitle>
            <p className="mt-2 text-sm/6">
              Paket akan dihapus dan tidak dapat dikembalikan.
            </p>
            <div className="mt-4 flex gap-1 items-center justify-end">
              <Button
                color="red"
                onClick={hapusHandler}
                loading={mutatingHapus}
              >
                Hapus
              </Button>
              <Button
                color="red100"
                onClick={() => hapusDispatch({ action: "close" })}
              >
                Batal
              </Button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};
