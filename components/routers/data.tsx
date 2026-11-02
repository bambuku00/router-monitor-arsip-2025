"use client";

import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import { Router, User } from "@prisma/client";
import Fuse from "fuse.js";
import { User as UserLucia } from "lucia";
import { useCallback, useMemo, useReducer, useState } from "react";
import toast from "react-hot-toast";
import { TbEdit, TbTrash } from "react-icons/tb";
import { useRouter } from "next/navigation";
import Pagination from "../pagination";
import Search from "../search";
import DialogData from "./dialog-data";
import TooltipMenu from "./tooltip-menu";
import {
  fetchDeleteRouter,
  routerDeleteConfirmText,
} from "./router-delete-shared";
import { canManageRouterConfig } from "@/lib/router-manage-access";
import { BiSolidEditAlt, BiSolidPlusCircle } from "react-icons/bi";
import { Tooltip } from "@mui/material";

/**
 * Baris Router untuk halaman list/edit /routers. Hanya field yang benar-benar dipakai
 * di komponen ini dan turunannya (dialog edit, tooltip menu, dsb).
 * `password` (kredensial RouterOS) SENGAJA tidak pernah ada di tipe ini maupun di data runtime-nya.
 */
export type SafeRouterRow = Pick<
  Router,
  | "id"
  | "nama"
  | "host"
  | "port"
  | "lat"
  | "lng"
  | "os_version"
  | "created"
  | "updated"
> &
  Partial<Pick<Router, "user" | "userId">> & {
  users?: Pick<User, "nama"> | null;
  _count?: { ppp_secret: number; pelanggan: number };
  /** PppSecret tanpa kartu pelanggan (tab Belum di PPP) */
  pppBelumInput?: number;
};

export type EditState = {
  modal: boolean;
  data?: SafeRouterRow;
};

export type EditAction =
  | { action: "open"; data: EditState["data"] }
  | { action: "close" }
  | { action: "data"; data: EditState["data"] };

export default function Data({
  routers,
  user,
}: {
  routers: SafeRouterRow[] | undefined;
  user?: UserLucia;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(
    Math.ceil((routers?.length || 1) / 10)
  );

  const [add, setAdd] = useState<boolean>(false);

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
  const { refresh } = useRouter();
  const [deletingRouterId, setDeletingRouterId] = useState<number | null>(null);

  const handleDeleteRouterRow = useCallback(
    async (row: SafeRouterRow) => {
      if (!window.confirm(routerDeleteConfirmText(row.nama))) return;
      setDeletingRouterId(row.id);
      const toastLoad = toast.loading("Menghapus router...");
      try {
        const message = await fetchDeleteRouter(row.id);
        toast.success(message, { id: toastLoad });
        refresh();
      } catch (err) {
        toast.error((err as Error).message, { id: toastLoad });
      } finally {
        setDeletingRouterId(null);
      }
    },
    [refresh]
  );

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(routers || [], {
        keys: ["nama", "host", "users.nama"],
        threshold: 0.3,
      }),
    [routers]
  );

  const filteredRouters = useMemo(() => {
    const data =
      query === "" ? routers : fuse.search(query).map((val) => val.item);
    const totalPagesParsed = Math.ceil((data?.length || 1) / 10);
    setTotalPages(totalPagesParsed);
    return data?.slice((page - 1) * 10, page * 10);
  }, [routers, page, query, fuse]);

  const canManageRouter = user ? canManageRouterConfig(user) : false;
  const canDeleteRouter = canManageRouter;

  return (
    <>
      <section className="grid grid-cols-3 gap-4 w-full relative">
        <Search
          isSearchParams={false}
          queryState={query}
          handleSearch={handleSearch}
        />
        <p className="flex justify-center font-medium">Routers List</p>
        {canManageRouter ? (
          <Button onClick={() => setAdd(true)} className="w-min justify-self-end">
            Tambah
          </Button>
        ) : (
          <span className="justify-self-end text-xs text-slate-500 self-center">
            Read-only
          </span>
        )}
      </section>
      <section className={cn("w-full overflow-x-auto rounded text-sm shadow hidden md:block")}>
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2">
              <td rowSpan={2}>No.</td>
              {user?.role === "Superadmin" ? (
                <td rowSpan={2}>Nama User</td>
              ) : null}
              <td rowSpan={2}>Nama</td>
              <td rowSpan={2}>Host</td>
              <td rowSpan={2}>Port</td>
              <td rowSpan={2}>Versi OS</td>
              {user?.role === "Superadmin" ? (
                <td colSpan={2} className="border-b border-b-slate-50">
                  Pelanggan
                </td>
              ) : null}
              <td rowSpan={2}>Tgl. Input</td>
              <td rowSpan={2} className="text-center">
                *
              </td>
            </tr>
            {user?.role === "Superadmin" ? (
              <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2">
                <td className="border-l border-l-slate-50">Jumlah</td>
                <td>Belum diinput</td>
              </tr>
            ) : null}
          </thead>
          <tbody>
            {filteredRouters && filteredRouters.length > 0 ? (
              filteredRouters.map((val, idx) => {
                const numberPage = page <= 1 ? 0 : (page - 1) * 10;
                const nomor = idx + 1 + numberPage;
                return (
                  <tr className="bg-slate-50/80 hover:text-sky-600" key={idx}>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {nomor + "."}
                    </td>
                    {user?.role === "Superadmin" ? (
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {val.users?.nama ?? "(Tanpa pemilik)"}
                      </td>
                    ) : null}
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.nama}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2 font-semibold">
                      {val.host}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2 font-semibold">
                      {val.port}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.os_version
                        ? `RouterOS ${val.os_version}`
                        : "-"}
                    </td>
                    {user?.role === "Superadmin" && val._count ? (
                      <>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {val._count.ppp_secret}
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {val.pppBelumInput ?? 0}
                        </td>
                      </>
                    ) : null}
                    <td className="whitespace-pre-wrap px-4 flex flex-col gap-1.5 py-2">
                      <Tooltip title="Created">
                        <div className="inline-flex w-fit items-center gap-1">
                          <BiSolidPlusCircle />
                          <p>
                            {new Date(val.created).toLocaleDateString("id-ID")}
                          </p>
                        </div>
                      </Tooltip>
                      <Tooltip title="Updated">
                        <div className="inline-flex w-fit items-center gap-1">
                          <BiSolidEditAlt />
                          <p>
                            {new Date(val.updated).toLocaleDateString("id-ID")}
                          </p>
                        </div>
                      </Tooltip>
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <div className="flex gap-2 justify-center">
                        {canManageRouter ? (
                          <Tooltip title="Ubah">
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
                          </Tooltip>
                        ) : null}
                        {canDeleteRouter ? (
                          <Tooltip title="Hapus router">
                            <Button
                              color="slatesky"
                              className="rounded"
                              disabled={deletingRouterId === val.id}
                              onClick={() => void handleDeleteRouterRow(val)}
                            >
                              <TbTrash className="size-4" />
                            </Button>
                          </Tooltip>
                        ) : null}
                        <TooltipMenu
                          router={val}
                          superAdmin={user?.role === "Superadmin"}
                          canDeleteRouter={canDeleteRouter}
                          canManageIsolir={canManageRouter}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-slate-50/80">
                <td colSpan={11}>
                  <p className="px-4 py-2 text-center">Belum ada data</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section className="flex flex-col gap-3 md:hidden w-full">
        {filteredRouters && filteredRouters.length > 0 ? (
          filteredRouters.map((val, idx) => {
            const numberPage = page <= 1 ? 0 : (page - 1) * 10;
            const nomor = idx + 1 + numberPage;
            return (
              <div
                key={idx}
                className="w-full bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                  <div className="flex flex-col">
                    <div className="font-bold text-base flex items-center gap-2">
                      <span className="text-slate-500 text-sm">{nomor}.</span>
                      <span>{val.nama}</span>
                    </div>
                    {user?.role === "Superadmin" && (
                      <span className="text-xs text-slate-500 mt-0.5">
                        User: {val.users?.nama ?? "(Tanpa pemilik)"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canManageRouter ? (
                      <Tooltip title="Ubah">
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
                      </Tooltip>
                    ) : null}
                    {canDeleteRouter ? (
                      <Tooltip title="Hapus router">
                        <Button
                          color="slatesky"
                          className="rounded"
                          disabled={deletingRouterId === val.id}
                          onClick={() => void handleDeleteRouterRow(val)}
                        >
                          <TbTrash className="size-4" />
                        </Button>
                      </Tooltip>
                    ) : null}
                    <TooltipMenu
                      router={val}
                      superAdmin={user?.role === "Superadmin"}
                      canDeleteRouter={canDeleteRouter}
                      canManageIsolir={
                        user?.role === "Superadmin" || user?.role === "Admin"
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Host
                    </span>
                    <span className="text-slate-700 font-mono">{val.host}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Port
                    </span>
                    <span className="text-slate-700 font-mono">{val.port}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Versi OS
                    </span>
                    <span className="text-slate-700">
                      {val.os_version
                        ? `RouterOS ${val.os_version}`
                        : "-"}
                    </span>
                  </div>

                  {user?.role === "Superadmin" && val._count ? (
                    <>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                          PPP Secret
                        </span>
                        <span className="text-slate-700">
                          {val._count.ppp_secret}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                          Belum Input
                        </span>
                        <span className="text-slate-700">
                          {val.pppBelumInput ?? 0}
                        </span>
                      </div>
                    </>
                  ) : null}

                  <div className="col-span-2 flex gap-4 text-xs text-slate-500 mt-1 pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-1">
                      <BiSolidPlusCircle className="text-slate-400" />
                      {new Date(val.created).toLocaleDateString("id-ID")}
                    </div>
                    <div className="flex items-center gap-1">
                      <BiSolidEditAlt className="text-slate-400" />
                      {new Date(val.updated).toLocaleDateString("id-ID")}
                    </div>
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
      <Pagination
        isSearchParams={false}
        pageState={page}
        totalPagesState={totalPages}
        onChange={(val) => setPage(val)}
      />
      {canManageRouter ? (
        <DialogData
          add={add}
          setAdd={setAdd}
          edit={edit}
          editDispatch={editDispatch}
        />
      ) : null}
    </>
  );
}
