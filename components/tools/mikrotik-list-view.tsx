"use client";

import { Button } from "@/components/button";
import Pagination from "@/components/pagination";
import Search from "@/components/search";
import MikrotikFilter, { MikrotikFilterTab } from "@/components/tools/mikrotik-filter";
import type { MikrotikSecretRow } from "@/lib/mikrotik-tools-rows";
import { Router } from "@prisma/client";
import { Tooltip } from "@mui/material";
import { FaUnlink } from "react-icons/fa";
import { FaPowerOff } from "react-icons/fa6";
import { IoSyncOutline } from "react-icons/io5";
import { TbEdit, TbPlus, TbTrash } from "react-icons/tb";
import { cn } from "@/lib/utils";

type Profile = {
  ".id": string;
  name: string;
  "local-address"?: string;
  "remote-address"?: string;
  "dns-server"?: string;
  "rate-limit"?: string;
};

type Props = {
  routers: Pick<Router, "id" | "nama" | "host">[];
  selectedRouter: string;
  setSelectedRouter: (id: string) => void;
  selectedRouterName: string;
  tab: "secrets" | "profiles";
  setTab: (tab: "secrets" | "profiles") => void;
  filterStatus: MikrotikFilterTab;
  setFilterStatus: React.Dispatch<React.SetStateAction<MikrotikFilterTab>>;
  filterStats: {
    semua: number;
    aktif: number;
    offline: number;
    disabled: number;
  };
  query: string;
  handleSearch: (val: string) => void;
  loading: boolean;
  retryConnect: () => void;
  openModal: (item?: MikrotikSecretRow | Profile) => void;
  paginatedData: (MikrotikSecretRow | Profile)[];
  filteredAndSearchedData: (MikrotikSecretRow | Profile)[];
  filterStatusLabel: string;
  page: number;
  limit: number;
  setLimit: (n: number) => void;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  handleKick: (name: string) => void;
  handleToggleDisable: (id: string, name: string, disabled: boolean) => void;
  handleDelete: (id: string) => void;
};

function isSecretRow(item: MikrotikSecretRow | Profile): item is MikrotikSecretRow {
  return "ipPppoe" in item;
}

export default function MikrotikListView({
  routers,
  selectedRouter,
  setSelectedRouter,
  selectedRouterName,
  tab,
  setTab,
  filterStatus,
  setFilterStatus,
  filterStats,
  query,
  handleSearch,
  loading,
  retryConnect,
  openModal,
  paginatedData,
  filteredAndSearchedData,
  filterStatusLabel,
  page,
  limit,
  setLimit,
  setPage,
  totalPages,
  handleKick,
  handleToggleDisable,
  handleDelete,
}: Props) {
  const tableColSpan = tab === "secrets" ? 7 : 6;

  const renderActions = (
    item: MikrotikSecretRow | Profile,
    isOnline: boolean,
    isDisabled: boolean
  ) => (
    <div className="flex gap-2 justify-center">
      {tab === "secrets" && isOnline && filterStatus === "active" && (
        <Tooltip title="Tendang user">
          <Button
            color="slatesky"
            className="rounded py-0.5"
            onClick={() => handleKick(item.name)}
          >
            <FaUnlink className="size-4" />
          </Button>
        </Tooltip>
      )}
      {tab === "secrets" && (
        <Tooltip title={isDisabled ? "Enable user" : "Disable user"}>
          <Button
            color="slatesky"
            className="rounded py-0.5"
            onClick={() =>
              handleToggleDisable(item[".id"], item.name, isDisabled)
            }
          >
            <FaPowerOff className="size-4" />
          </Button>
        </Tooltip>
      )}
      <Tooltip title="Edit">
        <Button
          color="slatesky"
          className="rounded py-0.5"
          onClick={() => openModal(item)}
        >
          <TbEdit className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip title="Hapus">
        <Button
          color="slatesky"
          className="rounded py-0.5"
          onClick={() => handleDelete(item[".id"])}
        >
          <TbTrash className="size-4" />
        </Button>
      </Tooltip>
    </div>
  );

  return (
    <>
      <section className="md:grid md:grid-cols-3 md:gap-4 gap-2 pb-4 w-full">
        <div className="flex gap-1.5 items-center w-full">
          <Search
            isSearchParams={false}
            queryState={query}
            handleSearch={handleSearch}
          />
          <Tooltip title="Hubungkan ulang">
            <span className="inline-block shrink-0">
              <button
                disabled={loading}
                type="button"
                className={cn(
                  "rounded bg-slate-200/75 dark:bg-theme-elevated px-2 py-1"
                )}
                onClick={retryConnect}
              >
                <IoSyncOutline className={cn(loading && "animate-spin")} />
              </button>
            </span>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 min-w-0">
            {tab === "secrets" ? (
              <MikrotikFilter
                filter={filterStatus}
                setFilter={setFilterStatus}
                setPage={setPage}
                data={filterStats}
                disabled={loading}
              />
            ) : (
              <p className="text-center text-sm text-slate-500 dark:text-theme-fg-muted w-full">
                PPP Profiles
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:justify-end">
          <select
            className="h-9 min-w-0 flex-1 md:flex-initial md:max-w-52 rounded-lg border-none bg-slate-200/80 dark:bg-theme-elevated dark:text-theme-fg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/25"
            value={selectedRouter}
            onChange={(e) => setSelectedRouter(e.target.value)}
          >
            {routers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama} ({r.host})
              </option>
            ))}
          </select>
          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              color="slatesky"
              className={cn(
                "text-xs py-1 px-2",
                tab === "secrets" &&
                  "ring-2 ring-slate-400 ring-offset-1 dark:ring-offset-theme-bg"
              )}
              onClick={() => setTab("secrets")}
            >
              Secrets
            </Button>
            <Button
              type="button"
              color="slatesky"
              className={cn(
                "text-xs py-1 px-2",
                tab === "profiles" &&
                  "ring-2 ring-slate-400 ring-offset-1 dark:ring-offset-theme-bg"
              )}
              onClick={() => setTab("profiles")}
            >
              Profiles
            </Button>
          </div>
          <Button
            onClick={() => openModal()}
            color="slatesky"
            className="text-xs py-1 px-2 w-min flex items-center gap-1"
          >
            <TbPlus className="size-4" />
            Tambah
          </Button>
        </div>
        <div className="md:col-span-3 flex flex-col md:flex-row md:justify-between gap-1 text-[10px]/3 sm:text-xs text-slate-700/90 dark:text-theme-fg-muted pt-1 border-t border-slate-100 dark:border-theme-border">
          <p>
            {tab === "secrets" ? "PPP Secrets" : "PPP Profiles"} · Router:{" "}
            {selectedRouterName}
          </p>
          <div className="flex items-center justify-end gap-3 md:gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-green-500 shrink-0" />
              <span>Online</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-slate-300 dark:bg-slate-500 shrink-0" />
              <span>Offline</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-red-500 shrink-0" />
              <span>Disabled</span>
            </span>
          </div>
        </div>
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
              {tab === "secrets" ? (
                <>
                  <td>Username PPPoE</td>
                  <td>Password PPPoE</td>
                  <td>Profile</td>
                  <td>Status</td>
                  <td>IP PPPoE</td>
                </>
              ) : (
                <>
                  <td>Nama</td>
                  <td>Local Address</td>
                  <td>Remote Address</td>
                  <td>Rate Limit</td>
                  <td>DNS Server</td>
                </>
              )}
              <td className="text-center">*</td>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={tableColSpan}>
                  <p className="px-4 py-2 text-center">Memuat...</p>
                </td>
              </tr>
            ) : filteredAndSearchedData.length === 0 ? (
              <tr className="bg-slate-50/80 dark:bg-theme-card/30">
                <td colSpan={tableColSpan}>
                  <p className="px-4 py-2 text-center">
                    Tidak ada data
                    {filterStatus !== "all" ? ` (${filterStatusLabel})` : ""}
                    {query ? ` untuk pencarian "${query}"` : ""}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedData.map((item, idx) => {
                const numberPage = page <= 1 ? 0 : (page - 1) * limit;
                const nomor = idx + 1 + numberPage;
                const secretRow = isSecretRow(item) ? item : null;
                const isOnline = secretRow?.isOnline ?? false;
                const isDisabled = secretRow?.statusLabel === "Disabled";

                return (
                  <tr
                    key={item[".id"]}
                    className={cn(
                      "bg-slate-50/80 dark:bg-theme-card/30 hover:text-sky-600 divide-x divide-y divide-slate-100 dark:divide-theme-border/40",
                      isDisabled && "bg-red-50/50 dark:bg-red-950/25"
                    )}
                  >
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {nomor + "."}
                    </td>
                    {tab === "secrets" && secretRow ? (
                      <>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-2 rounded-full shrink-0",
                                isDisabled
                                  ? "bg-red-500"
                                  : isOnline
                                    ? "bg-green-500"
                                    : "bg-slate-300"
                              )}
                            />
                            <span
                              className={cn(
                                isDisabled &&
                                  "text-red-600 dark:text-red-400 italic"
                              )}
                            >
                              {secretRow.name}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2 font-mono text-xs">
                          {secretRow.password || "-"}
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {secretRow.profile || "-"}
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          <span
                            className={cn(
                              "font-medium",
                              secretRow.statusLabel === "Online" &&
                                "text-green-700 dark:text-green-400",
                              secretRow.statusLabel === "Offline" &&
                                "text-slate-500 dark:text-slate-400",
                              secretRow.statusLabel === "Disabled" &&
                                "text-red-600 dark:text-red-400"
                            )}
                          >
                            {secretRow.statusLabel}
                          </span>
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2 font-mono text-xs">
                          {secretRow.ipPppoe}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {item.name}
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {item["local-address"] || "-"}
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {item["remote-address"] || "-"}
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {"rate-limit" in item
                            ? item["rate-limit"] || "-"
                            : "-"}
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {"dns-server" in item
                            ? item["dns-server"] || "-"
                            : "-"}
                        </td>
                      </>
                    )}
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {renderActions(item, isOnline, isDisabled)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3 md:hidden w-full">
        {loading ? (
          <div className="bg-slate-50 dark:bg-theme-card rounded-lg p-8 text-center text-slate-500 border border-slate-200 dark:border-theme-border border-dashed">
            <p className="text-sm">Memuat...</p>
          </div>
        ) : filteredAndSearchedData.length === 0 ? (
          <div className="bg-slate-50 dark:bg-theme-card rounded-lg p-8 text-center text-slate-500 border border-slate-200 dark:border-theme-border border-dashed">
            <p className="text-sm">Tidak ada data</p>
          </div>
        ) : (
          paginatedData.map((item, idx) => {
            const numberPage = page <= 1 ? 0 : (page - 1) * limit;
            const nomor = idx + 1 + numberPage;
            const secretRow = isSecretRow(item) ? item : null;
            const isOnline = secretRow?.isOnline ?? false;
            const isDisabled = secretRow?.statusLabel === "Disabled";

            return (
              <div
                key={item[".id"]}
                className={cn(
                  "w-full bg-white dark:bg-theme-card rounded-lg shadow-sm border border-slate-200 dark:border-theme-border p-3 flex flex-col gap-3",
                  isDisabled && "bg-red-50/30 dark:bg-red-950/25"
                )}
              >
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-theme-border pb-2">
                  <div className="flex flex-col">
                    <div className="font-bold text-base flex items-center gap-2">
                      <span className="text-slate-500 text-sm">{nomor}.</span>
                      <span
                        className={cn(isDisabled && "text-red-600 italic")}
                      >
                        {item.name}
                      </span>
                    </div>
                    {secretRow && (
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500 font-mono">
                        <p>
                          <span className="text-slate-400">Password: </span>
                          {secretRow.password || "-"}
                        </p>
                        <p>
                          <span className="text-slate-400">Profile: </span>
                          {secretRow.profile || "-"}
                        </p>
                        <p>
                          <span className="text-slate-400">IP: </span>
                          {secretRow.ipPppoe}
                        </p>
                      </div>
                    )}
                  </div>
                  {secretRow && (
                    <span
                      className={cn(
                        "text-sm font-bold uppercase",
                        secretRow.statusLabel === "Disabled" &&
                          "text-red-600",
                        secretRow.statusLabel === "Offline" &&
                          "text-slate-400",
                        secretRow.statusLabel === "Online" &&
                          "text-green-700"
                      )}
                    >
                      {secretRow.statusLabel}
                    </span>
                  )}
                </div>
                <div className="flex justify-end pt-1">
                  {renderActions(item, isOnline, isDisabled)}
                </div>
              </div>
            );
          })
        )}
      </section>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-theme-fg-muted">
          <span>Tampilkan</span>
          <select
            className="bg-slate-200/80 dark:bg-theme-elevated border-none rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
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
    </>
  );
}
