"use client";
import { cn, formatKiloBytes } from "@/lib/utils";
import { Bank, User } from "@prisma/client";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useReducer, useState } from "react";
import { TbEdit } from "react-icons/tb";
import Search from "../search";
import DialogBank from "./dialog-bank";
import { Button } from "@/components/button";
import { User as UserLucia } from "lucia";
import Fuse from "fuse.js";
import Pagination from "../pagination";

export type EditState = {
  modal: boolean;
  data?: Bank;
};

export type EditAction =
  | { action: "open"; data: EditState["data"] }
  | { action: "close" }
  | { action: "data"; data: EditState["data"] };

export default function DataBank({
  bank,
  user,
}: {
  bank: (Bank & { user?: User })[] | undefined;
  user?: UserLucia;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(bank || [], {
        keys: ["nama", "bank", "norek", "user.nama"],
        threshold: 0.3,
      }),
    [bank]
  );

  const filteredBank = useMemo(() => {
    const data =
      query === "" ? bank : fuse.search(query).map((val) => val.item);
    const totalPagesState = Math.ceil((data?.length || 1) / 10);
    setTotalPages(totalPagesState);
    return data?.slice((page - 1) * 10, page * 10);
  }, [bank, page, query, fuse]);

  return (
    <>
      <section className="grid grid-cols-3 gap-4 w-full relative">
        <Search
          isSearchParams={false}
          queryState={query}
          handleSearch={handleSearch}
        />
        <p className="flex justify-center font-medium">Bank List</p>
        <Button onClick={() => setAdd(true)} className="w-min justify-self-end">
          Tambah
        </Button>
      </section>
      <section className="flex flex-col gap-3 md:hidden w-full">
        {filteredBank && filteredBank.length > 0 ? (
          filteredBank.map((val, idx) => {
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
                      <span>{val.bank}</span>
                      {val.hideFromUnpaidInvoice ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          Tidak di inv belum lunas
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-col gap-1">
                      <span>A.N: {val.nama}</span>
                      <span className="font-mono">{val.norek}</span>
                      {user?.role === "Superadmin" && (
                        <span>User: {val.user?.nama || "Superadmin"}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      color="slatesky"
                      className="rounded p-2"
                      onClick={() =>
                        editDispatch({
                          action: "open",
                          data: val,
                        })
                      }
                    >
                      <TbEdit className="size-4" />
                    </Button>
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
      <section
        className={cn(
          "w-full overflow-x-auto rounded text-sm shadow hidden md:block"
        )}
      >
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2">
              <td>No.</td>
              {user?.role === "Superadmin" ? <td>Nama User</td> : null}
              <td>Bank</td>
              <td>Atas Nama</td>
              <td>No. Rekening</td>
              <td>Tgl. Input</td>
              <td className="text-center">*</td>
            </tr>
          </thead>
          <tbody>
            {filteredBank && filteredBank.length > 0 ? (
              filteredBank.map((val, idx) => {
                const numberPage = page <= 1 ? 0 : (page - 1) * 10;
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
                        {val.bank}
                        {val.hideFromUnpaidInvoice ? (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            Tidak di inv belum lunas
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.nama}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.norek}
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
      <Pagination
        isSearchParams={false}
        pageState={page}
        totalPagesState={totalPages}
        onChange={(val) => setPage(val)}
      />
      <DialogBank
        add={add}
        setAdd={setAdd}
        edit={edit}
        editDispatch={editDispatch}
        userId={user?.id}
      />
    </>
  );
}
