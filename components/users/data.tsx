"use client";

import { Button, linkButtonClassName } from "@/components/button";
import { cn } from "@/lib/utils";
import { Tooltip } from "@mui/material";
import { Client, ClientPerorangan, Layanan, User } from "@prisma/client";
import Fuse from "fuse.js";
import { User as UserLucia } from "lucia";
import {
  canAdminDeleteOwnStaff,
  userDeleteConfirmMessage,
} from "@/lib/rbac";
import { pembayaranHrefForUser } from "@/lib/staff-pelanggan-scope";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useReducer, useState } from "react";
import { FaUsers } from "react-icons/fa6";
import { HiBanknotes, HiOutlineDocumentCheck } from "react-icons/hi2";
import { TbEdit, TbTrash, TbBook } from "react-icons/tb";
import Search from "../search";
import DialogClient from "./dialog-client";
import DialogClientLayanan from "./dialog-client-layanan";
import DialogData from "./dialog-data";
import DialogVerify from "./dialog-verify";
import { FaUserCheck } from "react-icons/fa";
import { GrSearch } from "react-icons/gr";
import { Input } from "@headlessui/react";
import Pagination from "../pagination";
import toast from "react-hot-toast";

/**
 * Baris User untuk halaman list/edit /users. Hanya field yang benar-benar dipakai
 * di komponen ini (lihat app/(home)/users/page.tsx `userListSelect`).
 * `password` (hash Argon2) SENGAJA tidak pernah ada di tipe ini maupun di data runtime-nya.
 */
export type SafeUserRow = Pick<
  User,
  | "id"
  | "nama"
  | "user"
  | "role"
  | "parentId"
  | "omset"
  | "ppn"
  | "disabled"
  | "verified"
  | "created"
  | "nomor"
  | "alamat"
  | "revenueBasis"
  | "billingStartMode"
  | "billingStartDate"
  | "billingGenerateDay"
  | "freeCustomerLimit"
  | "pppPackageChangeLimit"
  | "pppAutoFillEnabled"
  | "portalPelangganEnabled"
  | "portalSlug"
  | "ownedByIsp"
  | "revenueShareEnabled"
  | "staffMenuKeys"
  | "staffAllowBankPayment"
  | "staffAllowIsolir"
  | "staffAllowCancelPayment"
  | "staffAllowBerhenti"
  | "identitas"
  | "no_identitas"
  | "npwp"
> & {
  parent?: Pick<User, "id" | "nama"> | null;
  client?:
    | (Client & {
        perorangan: ClientPerorangan[];
        layanan: Layanan[];
      })
    | null;
};

export type EditState = {
  modal: boolean;
  data?: SafeUserRow | null;
};

export type EditAction =
  | { action: "open"; data: EditState["data"] }
  | { action: "close" }
  | { action: "data"; data: EditState["data"] };

export type LayananClientState = {
  modal: boolean;
  data?:
    | (Client & {
        perorangan: ClientPerorangan[];
        layanan: Layanan[];
        nomor: string | null;
        alamat: string | null;
      })
    | null;
};

export type LayananClientAction =
  | { action: "open"; data: LayananClientState["data"] }
  | { action: "close" }
  | { action: "data"; data: LayananClientState["data"] };

function AdminAutoFillBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
        enabled
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-200 text-slate-600"
      )}
    >
      {enabled ? "Auto Fill Aktif" : "Auto Fill Nonaktif"}
    </span>
  );
}

function AdminPortalBadge({
  enabled,
  slug,
}: {
  enabled: boolean;
  slug?: string | null;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
        enabled
          ? "bg-sky-100 text-sky-800"
          : "bg-slate-200 text-slate-600"
      )}
    >
      {enabled ? "Portal Aktif" : "Portal Nonaktif"}
      {slug ? ` /pppoe/${slug}` : ""}
    </span>
  );
}

export default function Data({
  users,
  user,
}: {
  users: SafeUserRow[] | undefined;
  user: UserLucia;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(
    Math.ceil((users?.length || 1) / 10)
  );

  const [addUser, setAddUser] = useState<boolean>(false);
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
  const [editUser, editUserDispatch] = useReducer(editActs, editState);

  const [addClient, setAddClient] = useState<boolean>(false);
  const [editClient, editClientDispatch] = useReducer(editActs, editState);
  const [verify, verifyDispatch] = useReducer(editActs, editState);

  const layananClientState = {
    modal: false,
    data: undefined,
  };
  const layananClientActs = (
    state: LayananClientState,
    action: LayananClientAction
  ) => {
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
  const [layananClientUser, layananClientUserDispatch] = useReducer(
    layananClientActs,
    layananClientState
  );

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(users || [], {
        keys: ["nama", "parent.nama", "user"],
        threshold: 0.3,
      }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const data =
      query === "" ? users : fuse.search(query).map((val) => val.item);
    const totalPagesParsed = Math.ceil((data?.length || 1) / 10);
    setTotalPages(totalPagesParsed);
    return data?.slice((page - 1) * 10, page * 10);
  }, [users, page, query, fuse]);

  const canDeleteThisRow = useCallback(
    (row: NonNullable<typeof users>[number]) => {
      if (row.id === user.id) return false;
      if (user.role === "Superadmin") return true;
      return canAdminDeleteOwnStaff(user, row);
    },
    [user]
  );

  const confirmDeleteUser = useCallback(
    async (row: NonNullable<typeof users>[number]) => {
      if (!users) return;
      if (row.id === user.id) {
        toast.error("Anda tidak dapat menghapus akun Anda sendiri");
        return;
      }
      if (!canDeleteThisRow(row)) {
        toast.error("Tidak diizinkan menghapus user ini");
        return;
      }
      const sure = window.confirm(userDeleteConfirmMessage(user, row));
      if (!sure) return;
      try {
        const resp = await fetch(`/api/user/${row.id}`, { method: "DELETE" });
        const json = (await resp.json()) as { error?: string; message?: string };
        if (!resp.ok) {
          toast.error(json.error || "Gagal menghapus user");
          return;
        }
        toast.success(json.message ?? "User berhasil dihapus");
        router.refresh();
      } catch {
        toast.error("Gagal menghapus user");
      }
    },
    [users, user, router, canDeleteThisRow]
  );

  return (
    <>
      <section className="grid grid-cols-3 gap-4 w-full relative">
        <Search
          isSearchParams={false}
          queryState={query}
          handleSearch={handleSearch}
        />
        <p className="flex justify-center font-medium">Users List</p>
        <div className="grid sm:flex gap-2 justify-end">
          <Button
            onClick={() => setAddUser(true)}
            className="w-full sm:w-min justify-self-end justify-center"
          >
            Tambah
          </Button>
          {user.role === "Superadmin" ? (
            <Button
              onClick={() => setAddClient(true)}
              className="space-x-2 justify-self-end"
              color="cyan"
            >
              <span>
                <FaUsers />
              </span>
              <span>Tambah Client</span>
            </Button>
          ) : null}
        </div>
      </section>
      <section className="flex flex-col gap-3 md:hidden w-full">
        {filteredUsers && filteredUsers.length > 0 ? (
          filteredUsers.map((val, idx) => {
            const numberPage = page <= 1 ? 0 : (page - 1) * 10;
            const nomor = idx + 1 + numberPage;
            return (
              <div
                key={idx}
                className={cn(
                  "w-full bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex flex-col gap-3",
                  !val.verified && "border-red-200 bg-red-50"
                )}
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                  <div className="flex flex-col">
                    <div className="font-bold text-base flex items-center gap-2">
                      <span className="text-slate-500 text-sm">{nomor}.</span>
                      <span className={!val.verified ? "text-red-600" : ""}>
                        {val.nama}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span>
                          @{val.user} ({val.role})
                        </span>
                        {val.role === "Admin" ? (
                          <AdminAutoFillBadge
                            enabled={val.pppAutoFillEnabled === true}
                          />
                        ) : null}
                        {val.role === "Admin" ? (
                          <AdminPortalBadge
                            enabled={val.portalPelangganEnabled === true}
                            slug={val.portalSlug}
                          />
                        ) : null}
                      </span>
                      {user.role === "Superadmin" && val.parent && (
                        <span>Parent: {val.parent.nama}</span>
                      )}
                      <span>
                        Joined:{" "}
                        {new Date(val.created).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!val.verified && user.role === "Superadmin" && (
                      <Button
                        color="slatesky"
                        className="rounded p-2"
                        onClick={() =>
                          verifyDispatch({
                            action: "open",
                            data: val,
                          })
                        }
                      >
                        <FaUserCheck className="size-4" />
                      </Button>
                    )}

                    <Button
                      color="slatesky"
                      className="rounded p-2"
                      onClick={() =>
                        editUserDispatch({
                          action: "open",
                          data: val,
                        })
                      }
                    >
                      <TbEdit className="size-4" />
                    </Button>

                    {user.role === "Superadmin" && (
                        <Link
                            href={`/pembukuan/${val.id}`}
                            className={linkButtonClassName({
                                color: "slatesky",
                                className: "rounded p-2",
                            })}
                        >
                            <TbBook className="size-4" />
                        </Link>
                    )}
                    {canDeleteThisRow(val) && (
                      <Button
                        color="slatesky"
                        className="rounded p-2"
                        type="button"
                        onClick={() => confirmDeleteUser(val)}
                      >
                        <TbTrash className="size-4" />
                      </Button>
                    )}

                    {val.verified && val.client ? (
                      <Button
                        color="slatesky"
                        className="rounded p-2"
                        onClick={() =>
                          layananClientUserDispatch({
                            action: "open",
                            data: {
                              ...val.client!,
                              nomor: val.nomor,
                              alamat: val.alamat,
                            },
                          })
                        }
                      >
                        <HiOutlineDocumentCheck className="size-4" />
                      </Button>
                    ) : val.verified ? (
                      <Link
                        href={pembayaranHrefForUser(val)}
                        className={linkButtonClassName({
                          color: "slatesky",
                          className: "rounded p-2",
                        })}
                      >
                        <HiBanknotes className="size-4" />
                      </Link>
                    ) : null}
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
              {user.role === "Superadmin" ? <td>Nama Parent</td> : null}
              <td>Nama</td>
              <td>Username</td>
              <td>Role</td>
              <td>Tgl. Input</td>
              <td className="text-center">*</td>
            </tr>
          </thead>
          <tbody>
            {filteredUsers && filteredUsers.length > 0 ? (
              filteredUsers.map((val, idx) => {
                const numberPage = page <= 1 ? 0 : (page - 1) * 10;
                const nomor = idx + 1 + numberPage;
                return (
                  <tr
                    className={cn(
                      "bg-slate-50/80 hover:text-sky-600",
                      !val.verified && "text-red-500 hover:text-red-400"
                    )}
                    key={idx}
                  >
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {nomor + "."}
                    </td>
                    {user.role === "Superadmin" ? (
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {val.parent?.nama || ""}
                      </td>
                    ) : null}
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.nama}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.user}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{val.role}</span>
                        {val.role === "Admin" ? (
                          <AdminAutoFillBadge
                            enabled={val.pppAutoFillEnabled === true}
                          />
                        ) : null}
                        {val.role === "Admin" ? (
                          <AdminPortalBadge
                            enabled={val.portalPelangganEnabled === true}
                            slug={val.portalSlug}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {new Date(val.created).toLocaleDateString("id-ID")}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <div className="flex gap-2 justify-center">
                        {!val.verified && user.role === "Superadmin" ? (
                          <Tooltip title="Verifikasi">
                            <Button
                              color="slatesky"
                              type="button"
                              className="rounded"
                              onClick={() =>
                                verifyDispatch({
                                  action: "open",
                                  data: val,
                                })
                              }
                            >
                              <FaUserCheck />
                            </Button>
                          </Tooltip>
                        ) : null}
                        <Tooltip title="Ubah">
                          <Button
                            color="slatesky"
                            type="button"
                            className="rounded"
                            onClick={() =>
                              editUserDispatch({
                                action: "open",
                                data: val,
                              })
                            }
                          >
                            <TbEdit />
                          </Button>
                        </Tooltip>
                        {user.role === "Superadmin" && (
                            <Tooltip title="Pembukuan">
                                <span>
                                    <Link
                                        href={`/pembukuan/${val.id}`}
                                        className={linkButtonClassName({
                                            color: "slatesky",
                                            className: "rounded",
                                        })}
                                    >
                                        <TbBook />
                                    </Link>
                                </span>
                            </Tooltip>
                        )}
                        {canDeleteThisRow(val) && (
                          <Tooltip title="Hapus user">
                            <Button
                              color="slatesky"
                              type="button"
                              className="rounded"
                              onClick={() => confirmDeleteUser(val)}
                            >
                              <TbTrash />
                            </Button>
                          </Tooltip>
                        )}
                        {val.verified && val.client ? (
                          <Tooltip title="Layanan">
                            <span>
                              <Button
                                color="slatesky"
                                className="rounded"
                                onClick={() =>
                                  layananClientUserDispatch({
                                    action: "open",
                                    data: {
                                      ...val.client!,
                                      nomor: val.nomor,
                                      alamat: val.alamat,
                                    },
                                  })
                                }
                              >
                                <HiOutlineDocumentCheck />
                              </Button>
                            </span>
                          </Tooltip>
                        ) : val.verified ? (
                          <Tooltip title="Pembayaran">
                            <span>
                              <Link
                                href={pembayaranHrefForUser(val)}
                                className={linkButtonClassName({
                                  color: "slatesky",
                                  className: "rounded",
                                })}
                              >
                                <HiBanknotes />
                              </Link>
                            </span>
                          </Tooltip>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-slate-50/80">
                <td colSpan={10}>
                  <p className="px-4 py-2 text-center">Tidak ada data</p>
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
      <DialogData
        user={user}
        add={addUser}
        setAdd={setAddUser}
        edit={editUser}
        editDispatch={editUserDispatch}
        parents={
          users
            ?.filter((val) => val.role === "Admin" && val.parentId == null)
            .map((val) => ({ id: val.id, nama: val.nama })) || []
        }
      />
      <DialogClient
        user={user}
        add={addClient}
        setAdd={setAddClient}
        edit={editClient}
        editDispatch={editClientDispatch}
      />
      <DialogClientLayanan
        user={user}
        layananState={layananClientUser}
        layananDispatch={layananClientUserDispatch}
      />
      <DialogVerify verify={verify} verifyDispatch={verifyDispatch} />
    </>
  );
}
