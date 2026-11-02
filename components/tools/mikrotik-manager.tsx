"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import MikrotikListView from "@/components/tools/mikrotik-list-view";
import { Router } from "@prisma/client";
import Fuse from "fuse.js";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useCallback, useEffect, useRef, useState, useMemo, Fragment } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FaExclamationTriangle } from "react-icons/fa";
import { TIME } from "@/lib/constants";
import {
  flattenRouterOsRecord,
  mergeSecretRows,
  parseProxyList,
  type MikrotikSecretRow,
} from "@/lib/mikrotik-tools-rows";
import { cn } from "@/lib/utils";

/** Client timeout for proxy requests; stop waiting if server doesn't respond (e.g. server hanging on dead MikroTik). */
const PROXY_FETCH_TIMEOUT_MS = 8_000;
const CONNECTION_ERROR_MSG = "Tidak dapat terhubung ke RouterOS";

function fetchProxyWithTimeout(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
  timeoutMs = PROXY_FETCH_TIMEOUT_MS
): Promise<Response> {
  const parentSignal = options.signal;
  const controller = new AbortController();
  let cleanup: () => void = () => {};
  const timeoutId = { current: 0 };
  const timeoutPromise = new Promise<Response>((_, reject) => {
    timeoutId.current = window.setTimeout(() => {
      cleanup();
      controller.abort();
      reject(new Error(CONNECTION_ERROR_MSG));
    }, timeoutMs);
  });
  cleanup = () => {
    if (timeoutId.current) clearTimeout(timeoutId.current);
    timeoutId.current = 0;
    parentSignal?.removeEventListener("abort", onParentAbort);
  };
  const onParentAbort = () => {
    cleanup();
    controller.abort();
  };
  if (parentSignal) {
    parentSignal.addEventListener("abort", onParentAbort);
    if (parentSignal.aborted) {
      cleanup();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    }
  }
  const fetchPromise = fetch(url, { ...options, signal: controller.signal }).finally(cleanup);
  return Promise.race([fetchPromise, timeoutPromise]);
}

type Props = {
  routers: Pick<Router, "id" | "nama" | "host">[];
};

type Secret = {
  ".id": string;
  name: string;
  password?: string;
  service: string;
  profile: string;
  "local-address"?: string;
  "remote-address"?: string;
  comment?: string;
  disabled?: string;
};

type Profile = {
  ".id": string;
  name: string;
  "local-address"?: string;
  "remote-address"?: string;
  "dns-server"?: string;
  "rate-limit"?: string;
  "only-one"?: string;
  default?: string;
};

export default function MikrotikManager({ routers }: Props) {
  const [selectedRouter, setSelectedRouter] = useState<string>(() =>
    routers?.length ? String(routers[0].id) : ""
  );
  const [tab, setTab] = useState<"secrets" | "profiles">("secrets");
  const [data, setData] = useState<(Secret | Profile)[]>([]);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [activeConnections, setActiveConnections] = useState<unknown[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "offline" | "disabled">("all");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [connectionError, setConnectionError] = useState(false);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState("");
  const connectionErrorRef = useRef(false);
  const connectionErrorMessageRef = useRef("");
  const isFetchingRef = useRef(false);
  const confirmDialogOpenRef = useRef(false);
  /** Increment when "Hubungkan Ulang" sukses agar effect polling re-run dan realtime jalan lagi (dependency array tetap 3 elemen). */
  const [pollingRestartKey, setPollingRestartKey] = useState(0);
  /** Abort in-flight requests when we detect disconnect so late 200 responses don't affect UI. */
  const controllerRef = useRef<AbortController | null>(null);
  /** Maksimal 60 siklus polling (10 detik × 60 = 10 menit), lalu stop; reset saat refresh atau Hubungkan Ulang. */
  const pollCountRef = useRef(0);
  /** Id setTimeout untuk poll berikutnya (pakai setTimeout berantai, bukan setInterval). */
  const pollTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Waktu terakhir poll (ms). */
  const lastPollAtRef = useRef(0);
  /** Timeout id untuk initial load; di-clear di cleanup agar React Strict Mode hanya jalankan satu kali. */
  const initialLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True after we've seen non-empty data; used to treat "200 with empty" as disconnect and stop polling. */
  const hadDataBeforeRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editData, setEditData] = useState<Secret | Profile | MikrotikSecretRow | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel: string;
    cancelLabel: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Ya, Lanjutkan",
    cancelLabel: "Batal",
    variant: "info",
    onConfirm: async () => {},
  });

  const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    confirmDialogOpenRef.current = confirmDialog.isOpen;
  }, [confirmDialog.isOpen]);

  useEffect(() => {
    if (isOpen && selectedRouter) fetchProfilesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when modal opens or router changes; fetchProfilesList uses selectedRouter from closure
  }, [isOpen, selectedRouter]);

  const markDisconnected = (message: string) => {
    connectionErrorRef.current = true;
    setConnectionError(true);
    connectionErrorMessageRef.current = message;
    setConnectionErrorMessage(message);
    controllerRef.current?.abort();
  };

  const markConnected = () => {
    connectionErrorRef.current = false;
    connectionErrorMessageRef.current = "";
    if (connectionError) setConnectionError(false);
    if (connectionErrorMessage) setConnectionErrorMessage("");
  };

  useEffect(() => {
    if (routers.length > 0 && !selectedRouter) {
      setSelectedRouter(String(routers[0].id));
    }
  }, [routers, selectedRouter]);

  useEffect(() => {
    connectionErrorRef.current = false;
    connectionErrorMessageRef.current = "";
    hadDataBeforeRef.current = false;
    setConnectionError(false);
    setConnectionErrorMessage("");
  }, [selectedRouter]);

  const fetchActiveConnections = async (isBackground = false, signal?: AbortSignal) => {
    if (!selectedRouter) return;
    try {
      const res = await fetchProxyWithTimeout("/api/tools/mikrotik/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routerId: selectedRouter,
          command: "/ppp/active/print",
        }),
        signal,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        const msg = json?.error ? String(json.error) : res.statusText || "Tidak dapat terhubung ke RouterOS";
        markDisconnected(msg);
        setActiveConnections([]);
        if (!isBackground) toast.error(`Gagal mengambil data koneksi aktif: ${msg}`);
        return;
      }
      setActiveConnections(parseProxyList(json));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message;
        markDisconnected(msg);
        setActiveConnections([]);
        if (!isBackground) toast.error(`Gagal mengambil data koneksi aktif: ${msg}`);
      }
    }
  };

  const fetchProfilesList = async (signal?: AbortSignal) => {
    if (!selectedRouter) return;
    try {
      const res = await fetchProxyWithTimeout("/api/tools/mikrotik/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routerId: selectedRouter,
          command: "/ppp/profile/print",
        }),
        signal,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        const msg = json?.error ? String(json.error) : res.statusText || "Tidak dapat terhubung ke RouterOS";
        markDisconnected(msg);
        toast.error(`Gagal mengambil data profiles: ${msg}`);
        return;
      }
      setProfilesList(parseProxyList(json) as Profile[]);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message;
        markDisconnected(msg);
        toast.error(`Gagal mengambil data profiles: ${msg}`);
      }
    }
  };

  const fetchData = async (
    isBackground = false,
    signal?: AbortSignal,
    options?: { clearErrorOnSuccess?: boolean }
  ) => {
    if (!selectedRouter) return;
    if (!isBackground) setLoading(true);
    try {
      const command =
        tab === "secrets" ? "/ppp/secret/print" : "/ppp/profile/print";
      const res = await fetchProxyWithTimeout("/api/tools/mikrotik/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routerId: selectedRouter,
          command,
        }),
        signal,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        const msg = json?.error ? String(json.error) : res.statusText || "Tidak dapat terhubung ke RouterOS";
        throw new Error(msg);
      }
      const list = parseProxyList(json);
      setData(list as (Secret | Profile)[]);
      if (tab === "profiles") setProfilesList(list as Profile[]);
      if (!isBackground && options?.clearErrorOnSuccess) {
        markConnected();
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const errorMsg = (err as Error).message;
      markDisconnected(errorMsg);
      setData([]);
      if (!isBackground) toast.error(errorMsg);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const retryConnect = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    pollCountRef.current = 0;
    const controller = new AbortController();
    try {
      await Promise.allSettled([
        fetchData(false, controller.signal, { clearErrorOnSuccess: true }),
        fetchActiveConnections(false, controller.signal),
      ]);
      if (!connectionErrorRef.current) {
        setPollingRestartKey((k) => k + 1);
      }
    } finally {
      controller.abort();
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    // Initial load ditunda satu tick agar di React Strict Mode hanya satu yang jalan (cleanup batalkan yang pertama).
    initialLoadTimeoutRef.current = setTimeout(() => {
      initialLoadTimeoutRef.current = null;
      if (!controller.signal.aborted && !isFetchingRef.current) {
        isFetchingRef.current = true;
        lastPollAtRef.current = Date.now();
        Promise.allSettled([
          fetchData(false, controller.signal),
          fetchActiveConnections(false, controller.signal),
        ]).finally(() => {
          isFetchingRef.current = false;
        });
      }
    }, 0);

    const POLL_INTERVAL_MS = 10_000;
    const MAX_POLL_CYCLES = 60;

    function scheduleNextPoll() {
      if (controller.signal.aborted) return;
      if (connectionErrorRef.current) return;
      if (confirmDialogOpenRef.current) return;
      if (pollCountRef.current >= MAX_POLL_CYCLES) return;
      pollTimeoutIdRef.current = setTimeout(() => {
        pollTimeoutIdRef.current = null;
        if (controller.signal.aborted) return;
        if (connectionErrorRef.current) return;
        if (confirmDialogOpenRef.current) return;
        if (pollCountRef.current >= MAX_POLL_CYCLES) return;
        lastPollAtRef.current = Date.now();
        pollCountRef.current += 1;
        fetchData(true, controller.signal);
        if (tab === "secrets") {
          fetchActiveConnections(true, controller.signal);
        }
        scheduleNextPoll();
      }, POLL_INTERVAL_MS);
    }

    // Jadwal poll pertama 10 detik dari sekarang (setelah initial load).
    pollTimeoutIdRef.current = setTimeout(() => {
      pollTimeoutIdRef.current = null;
      if (controller.signal.aborted) return;
      if (connectionErrorRef.current) return;
      lastPollAtRef.current = Date.now();
      pollCountRef.current += 1;
      fetchData(true, controller.signal);
      if (tab === "secrets") {
        fetchActiveConnections(true, controller.signal);
      }
      scheduleNextPoll();
    }, POLL_INTERVAL_MS);

    return () => {
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
        initialLoadTimeoutRef.current = null;
      }
      if (pollTimeoutIdRef.current) {
        clearTimeout(pollTimeoutIdRef.current);
        pollTimeoutIdRef.current = null;
      }
      controllerRef.current = null;
      controller.abort();
    };
    // pollingRestartKey: naik saat Hubungkan Ulang sukses → effect re-run, controller baru, realtime jalan lagi. Array size tetap 3.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData/fetchProfilesList/fetchActiveConnections intentionally excluded
  }, [selectedRouter, tab, pollingRestartKey]);

  const secretRows = useMemo(() => {
    if (tab !== "secrets") return [];
    return mergeSecretRows(data, activeConnections);
  }, [data, activeConnections, tab]);

  // Calculate stats
  const totalSecrets = tab === "secrets" ? secretRows.length : 0;
  const activeCount = tab === "secrets" ? secretRows.filter((r) => r.isOnline).length : 0;
  const disabledCount =
    tab === "secrets"
      ? secretRows.filter((r) => r.statusLabel === "Disabled").length
      : 0;
  const offlineCount =
    tab === "secrets"
      ? secretRows.filter((r) => r.statusLabel === "Offline").length
      : 0;

  const filterStats = useMemo(
    () => ({
      semua: totalSecrets,
      aktif: activeCount,
      offline: offlineCount,
      disabled: disabledCount,
    }),
    [totalSecrets, activeCount, offlineCount, disabledCount]
  );

  const selectedRouterName =
    routers.find((r) => String(r.id) === selectedRouter)?.nama ?? "-";

  const tableSourceData = useMemo((): (MikrotikSecretRow | Profile)[] => {
    return tab === "secrets" ? secretRows : (data as Profile[]);
  }, [tab, secretRows, data]);

  const statusFilteredData = useMemo(() => {
    return tableSourceData.filter((item) => {
      if (tab !== "secrets") return true;
      if (filterStatus === "all") return true;

      const row = item as MikrotikSecretRow;
      if (filterStatus === "active") return row.isOnline;
      if (filterStatus === "disabled") return row.statusLabel === "Disabled";
      if (filterStatus === "offline") return row.statusLabel === "Offline";
      return true;
    });
  }, [tableSourceData, tab, filterStatus]);

  const fuse = useMemo(
    () =>
      new Fuse(statusFilteredData || [], {
        keys:
          tab === "secrets"
            ? ["name", "password", "profile", "ipPppoe", "statusLabel", "comment"]
            : ["name", "local-address", "remote-address", "rate-limit", "dns-server"],
        threshold: 0.3,
      }),
    [statusFilteredData, tab]
  );

  const filteredAndSearchedData = useMemo(() => {
    return query === "" 
      ? statusFilteredData 
      : fuse.search(query).map((val) => val.item);
  }, [statusFilteredData, query, fuse]);

  const totalPages = Math.ceil((filteredAndSearchedData.length || 1) / limit);

  const paginatedData = useMemo(() => {
    return filteredAndSearchedData.slice((page - 1) * limit, page * limit);
  }, [filteredAndSearchedData, page, limit]);

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const findActiveRecord = useCallback(
    (username: string) => {
      const key = String(username);
      return activeConnections
        .map((record) => flattenRouterOsRecord(record))
        .find((active) => String(active.name) === key);
    },
    [activeConnections]
  );

  const handleKick = async (name: string, withConfirm = true) => {
    const activeConn = findActiveRecord(name);
    if (!activeConn) {
      if (withConfirm) toast.error("User tidak sedang aktif");
      return;
    }

    const executeKick = async () => {
      const toastId = toast.loading("Menendang user...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIME.REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch("/api/tools/mikrotik/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            routerId: selectedRouter,
            command: "/ppp/active/remove",
            data: [`=.id=${activeConn[".id"]}`],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const json = await res.json();
        if (json.error) throw new Error(json.error);
        toast.success("User berhasil ditendang", { id: toastId });
        
        // Optimistic update
        setActiveConnections((prev) =>
          prev.filter(
            (record) => String(flattenRouterOsRecord(record).name) !== String(name)
          )
        );
      } catch (err) {
        clearTimeout(timeoutId);
        if ((err as Error).name === 'AbortError') {
           toast.success("Perintah dikirim (Koneksi lambat, cek status sesaat lagi)", { 
              id: toastId,
              icon: '⚠️'
           });
           // Keep optimistic update
           setActiveConnections((prev) =>
             prev.filter(
               (record) =>
                 String(flattenRouterOsRecord(record).name) !== String(name)
             )
           );
        } else {
           const msg = (err as Error).message || String(err);
           toast.error(msg, { id: toastId });
        }
      } finally {
        closeConfirm();
        fetchActiveConnections(true); // Background refresh
      }
    };
    
    if (withConfirm) {
      setConfirmDialog({
        isOpen: true,
        title: "Konfirmasi Kick User",
        message: (
          <p>
            Apakah Anda yakin ingin menendang user <span className="font-bold text-slate-900">{name}</span> dari jaringan?
          </p>
        ),
        confirmLabel: "Ya, Tendang",
        cancelLabel: "Batal",
        variant: "warning",
        onConfirm: executeKick,
      });
    } else {
      await executeKick();
    }
  };

  const handleToggleDisable = async (id: string, name: string, currentDisabled: boolean) => {
    const action = currentDisabled ? "enable" : "disable";
    const targetDisabled = currentDisabled ? "no" : "yes";

    setConfirmDialog({
      isOpen: true,
      title: `${currentDisabled ? "Enable" : "Disable"} User`,
      message: (
        <p>
          Apakah Anda yakin ingin melakukan <span className="font-bold">{action}</span> pada user <span className="font-bold text-slate-900">{name}</span>?
        </p>
      ),
      confirmLabel: "Ya, Lanjutkan",
      cancelLabel: "Batal",
      variant: currentDisabled ? "info" : "danger",
      onConfirm: async () => {
        const toastId = toast.loading("Memproses...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout (longer for potentially 2 requests)

        try {
          const res = await fetch("/api/tools/mikrotik/proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              routerId: selectedRouter,
              command: "/ppp/secret/set",
              data: [`=.id=${id}`, `=disabled=${targetDisabled}`],
            }),
            signal: controller.signal,
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error);
          
          // Auto kick if disabling and user is active
          if (targetDisabled === "yes") {
             const activeConn = findActiveRecord(name);
             if (activeConn) {
                 toast.loading("Memutuskan koneksi user...", { id: toastId });
                 await fetch("/api/tools/mikrotik/proxy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      routerId: selectedRouter,
                      command: "/ppp/active/remove",
                      data: [`=.id=${activeConn[".id"]}`],
                    }),
                    signal: controller.signal,
                  });
                 fetchActiveConnections();
             }
          }

          clearTimeout(timeoutId);
          toast.success(`User berhasil di-${action}`, { id: toastId });
          fetchData();
          closeConfirm();
        } catch (err) {
          clearTimeout(timeoutId);
          const msg = (err as Error).name === 'AbortError' ? 'Request timeout (20s)' : ((err as Error).message || String(err));
          toast.error(msg, { id: toastId });
        }
      },
    });
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Hapus Data",
      message: "Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.",
      confirmLabel: "Ya, Hapus",
      cancelLabel: "Batal",
      variant: "danger",
      onConfirm: async () => {
        const toastId = toast.loading("Menghapus...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        try {
          const command =
            tab === "secrets" ? "/ppp/secret/remove" : "/ppp/profile/remove";
          const res = await fetch("/api/tools/mikrotik/proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              routerId: selectedRouter,
              command,
              data: [`=.id=${id}`],
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const json = await res.json();
          if (json.error) throw new Error(json.error);
          toast.success("Berhasil dihapus", { id: toastId });
          fetchData();
          closeConfirm();
        } catch (err) {
          clearTimeout(timeoutId);
          const msg = (err as Error).name === 'AbortError' ? 'Request timeout (15s)' : ((err as Error).message || String(err));
          toast.error(msg, { id: toastId });
        }
      },
    });
  };

  const openModal = (item?: MikrotikSecretRow | Profile) => {
    setEditData(item || null);
    setIsOpen(true);
  };

  if (routers.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-6 rounded-lg text-center">
        <p className="font-medium">Tidak ada router.</p>
        <p className="text-sm mt-1 text-amber-700">
          Tambah router dulu di halaman{" "}
          <a href="/routers" className="underline font-medium hover:text-amber-900">
            Routers
          </a>{" "}
          untuk menggunakan MikroTik Tools.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <section className="grid grid-cols-3 gap-4 w-full relative">
        <div />
        <p className="flex justify-center font-medium">Mikrotik Tools</p>
        <div />
      </section>

      {connectionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="size-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                {connectionErrorMessage || "Tidak dapat terhubung ke RouterOS"}
              </p>
              <p className="text-xs text-red-600/80">
                Realtime dihentikan. Periksa koneksi, port, atau user/password router.
              </p>
            </div>
          </div>
          <Button
            onClick={retryConnect}
            disabled={loading}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-transparent shadow-none"
          >
            {loading ? "Menghubungkan..." : "Coba Hubungkan Ulang"}
          </Button>
        </div>
      )}

      <MikrotikListView
        routers={routers}
        selectedRouter={selectedRouter}
        setSelectedRouter={setSelectedRouter}
        selectedRouterName={selectedRouterName}
        tab={tab}
        setTab={setTab}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterStats={filterStats}
        query={query}
        handleSearch={handleSearch}
        loading={loading}
        retryConnect={retryConnect}
        openModal={openModal}
        paginatedData={paginatedData}
        filteredAndSearchedData={filteredAndSearchedData}
        filterStatusLabel={filterStatus}
        page={page}
        limit={limit}
        setLimit={setLimit}
        setPage={setPage}
        totalPages={totalPages}
        handleKick={handleKick}
        handleToggleDisable={handleToggleDisable}
        handleDelete={handleDelete}
      />

      <FormModal
        isOpen={isOpen}
        close={() => setIsOpen(false)}
        routerId={selectedRouter}
        tab={tab}
        editData={editData}
        refresh={() => {
          fetchData();
          fetchProfilesList();
        }}
        profiles={profilesList}
      />

      <Transition appear show={confirmDialog.isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeConfirm}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
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
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex flex-col items-center gap-4">
                     <div className={cn(
                        "p-3 rounded-full",
                        confirmDialog.variant === "danger" ? "bg-red-100 text-red-600" :
                        confirmDialog.variant === "warning" ? "bg-amber-100 text-amber-600" :
                        "bg-blue-100 text-blue-600"
                     )}>
                        <FaExclamationTriangle className="size-6" />
                     </div>
                     <DialogTitle as="h3" className="text-lg font-medium leading-6 text-gray-900 text-center">
                        {confirmDialog.title}
                     </DialogTitle>
                     <div className="mt-2 text-center">
                        <div className="text-sm text-gray-500">
                          {confirmDialog.message}
                        </div>
                     </div>
                  </div>

                  <div className="mt-6 flex justify-center gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                      onClick={closeConfirm}
                    >
                      {confirmDialog.cancelLabel}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                        confirmDialog.variant === "danger" ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500" :
                        confirmDialog.variant === "warning" ? "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500" :
                        "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
                      )}
                      onClick={() => {
                         confirmDialog.onConfirm();
                      }}
                    >
                      {confirmDialog.confirmLabel}
                    </button>
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

function FormModal({
  isOpen,
  close,
  routerId,
  tab,
  editData,
  refresh,
  profiles,
}: {
  isOpen: boolean;
  close: () => void;
  routerId: string;
  tab: "secrets" | "profiles";
  editData: Secret | Profile | null;
  refresh: () => void;
  profiles: Profile[];
}) {
  const { register, handleSubmit, reset } = useForm<Secret | Profile>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editData) {
      const defaults = {
        name: "",
        password: "",
        service: "any",
        profile: "default",
        "local-address": "",
        "remote-address": "",
        comment: "",
        "dns-server": "",
        "rate-limit": "",
      };
      const defaultValues = { ...defaults, ...editData };
      if (!("comment" in defaultValues) || !defaultValues.comment) (defaultValues as Record<string, unknown>).comment = "";
      reset(defaultValues);
    } else {
      reset({
        name: "",
        password: "",
        service: tab === "secrets" ? "pppoe" : "any",
        profile: "default",
        "local-address": "",
        "remote-address": "",
        comment: "",
        "dns-server": "",
        "rate-limit": "",
      });
    }
  }, [editData, tab, reset]);

  const onSubmit = async (data: Secret | Profile) => {
    setLoading(true);
    const toastId = toast.loading("Menyimpan...");
    try {
      let command = "";
      const payload: string[] = [];

      if (editData) {
        command = tab === "secrets" ? "/ppp/secret/set" : "/ppp/profile/set";
        // .id is required for set
        payload.push(`=.id=${editData[".id"]}`);
      } else {
        command = tab === "secrets" ? "/ppp/secret/add" : "/ppp/profile/add";
      }

      // Filter empty strings and build payload array
      const ALLOWED_FIELDS =
        tab === "secrets"
          ? [
              "name",
              "password",
              "service",
              "profile",
              "local-address",
              "remote-address",
              "comment",
              "disabled",
            ]
          : [
              "name",
              "local-address",
              "remote-address",
              "dns-server",
              "rate-limit",
              "only-one",
              "default",
              "use-mpls",
              "use-compression",
              "use-encryption",
            ];

      const dataRecord = data as Record<string, unknown>;
      Object.keys(dataRecord).forEach((key) => {
        const value = dataRecord[key];
        if (
          ALLOWED_FIELDS.includes(key) &&
          value !== undefined &&
          value !== null
        ) {
          // Skip empty strings for address fields to avoid "invalid value for argument address"
          if (
            value === "" &&
            [
              "local-address",
              "remote-address",
              "dns-server",
              "rate-limit",
            ].includes(key)
          ) {
            return;
          }
          payload.push(`=${key}=${value}`);
        }
      });

      const res = await fetch("/api/tools/mikrotik/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routerId,
          command,
          data: payload,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success("Berhasil disimpan", { id: toastId });
      close();
      refresh();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={close}>
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
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  {editData ? "Edit" : "Tambah"}{" "}
                  {tab === "secrets" ? "PPP Secret" : "PPP Profile"}
                </DialogTitle>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Name</label>
                    <Input {...register("name")} required />
                  </div>
                  
                  {tab === "secrets" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Password</label>
                        <Input {...register("password")} required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Service</label>
                        <select
                          {...register("service")}
                          className="w-full rounded-lg border-none bg-slate-200/80 py-1.5 px-3 text-sm/6 focus:outline-none"
                        >
                          <option value="any">any</option>
                          <option value="pppoe">pppoe</option>
                          <option value="pptp">pptp</option>
                          <option value="sstp">sstp</option>
                          <option value="l2tp">l2tp</option>
                          <option value="ovpn">ovpn</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Profile</label>
                        <select
                          {...register("profile")}
                          className="w-full rounded-lg border-none bg-slate-200/80 py-1.5 px-3 text-sm/6 focus:outline-none"
                        >
                          <option value="default">default</option>
                          {profiles?.filter(p => p.name !== "default").map((p) => (
                            <option key={p[".id"]} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Local Address</label>
                    <Input {...register("local-address")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Remote Address</label>
                    <Input {...register("remote-address")} />
                  </div>

                  {tab === "secrets" && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Comment</label>
                      <Input {...register("comment")} />
                    </div>
                  )}

                  {tab === "profiles" && (
                    <>
                       <div className="space-y-1">
                        <label className="text-sm font-medium">DNS Server</label>
                        <Input {...register("dns-server")} placeholder="8.8.8.8,8.8.4.4" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Rate Limit</label>
                        <Input {...register("rate-limit")} placeholder="1M/1M" />
                      </div>
                    </>
                  )}

                  <div className="mt-6 flex justify-end gap-2">
                    <Button
                      type="button"
                      color="red100"
                      onClick={close}
                      disabled={loading}
                    >
                      Batal
                    </Button>
                    <Button type="submit" loading={loading}>
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
  );
}
