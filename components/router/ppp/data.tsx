"use client";

import { Button } from "@/components/button";
import Pagination from "@/components/pagination";
import Search from "@/components/search";
import { EditAction, EditState } from "@/lib/ppp-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { nominalPaketForDisplay } from "@/lib/paket-persist";
import {
  GetPPP,
  syncPPP,
  getPPPProfiles,
  revalidatePPP,
} from "@/lib/server-actions/router/ppp/actions";
import { isPppSyncError, type ExecutePppSyncResult } from "@/lib/ppp-sync/result";
import {
  claimPppAutoSync,
  logPppPageEvent,
  refreshPppTableAfterSync,
  releasePppAutoSync,
} from "@/lib/ppp-page-sync";
import { ArrayElementType, cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import { Tooltip } from "@mui/material";
import { Paket, Router, RoleName } from "@prisma/client";
import Fuse from "fuse.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { FaCheck } from "react-icons/fa";
import { FaChevronDown } from "react-icons/fa6";
import { TbArrowsUpDown, TbCalendar, TbDownload, TbEyeEdit, TbFileImport, TbHeartRateMonitor, TbKey, TbRefresh, TbTrash, TbPlus, TbUserPlus, TbUsers } from "react-icons/tb";
import DialogEdit from "./dialog-edit";
import DialogPackageChange, {
  type PackageChangeResult,
} from "./dialog-package-change";
import DialogPortalPin from "./dialog-portal-pin";
import DialogAdd from "./dialog-add";
import DialogBulkFillPelanggan from "./dialog-bulk-fill-pelanggan";
import DialogBulkTglIsolir from "./dialog-bulk-tgl-isolir";
import DialogBulkTglBerlangganan from "./dialog-bulk-tgl-berlangganan";
import DialogBulkPetugas, {
  type BulkPetugasMode,
} from "./dialog-bulk-petugas";
import { canAccessPenagihan } from "@/lib/penagih-rules";
import { listSubscriptionMonths } from "@/lib/ppp-subscription-month";
import PppFreeQuotaBadge from "./ppp-free-quota-badge";
import FilterPPP, { Tabs } from "./filter";
import PppWorkGreeting from "./work-greeting";
import IsolirSetupDialog from "../isolir-setup-dialog";
import {
  isPppBerhentiTab,
  isPppNonaktifTab,
} from "@/lib/ppp-nonaktif-berhenti";
import { isPppIsolir } from "@/lib/ppp-isolir";
import { isPppSecretDisabled } from "@/lib/mikrotik-ppp-secret-active";
import { isPelangganAutoFilled } from "@/lib/pelanggan-auto-filled";
import { AUTO_FILL_NO_PACKAGE_MESSAGE } from "@/lib/ppp-auto-fill-message";
import type { PppFreeCustomerQuotaStats } from "@/lib/ppp-page-stats";
import { boosterDaysLeft } from "@/lib/ppp-booster";

type BulkPppScope = "nonaktif" | "berhenti" | "off-router";

function PackageChangeMark({
  mark,
}: {
  mark?: { direction: "upgrade" | "downgrade"; created: string } | null;
}) {
  if (!mark) return null;
  const label = mark.direction === "downgrade" ? "Downgrade" : "Upgrade";
  const when = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(mark.created));
  return (
    <Tooltip title={`${label} oleh mitra · ${when}`}>
      <span className="cursor-help rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        {label}
      </span>
    </Tooltip>
  );
}

function BoosterMark({
  booster,
}: {
  booster?: { profile: string; endsAt: string; days: number } | null;
}) {
  if (!booster) return null;
  const ends = new Date(booster.endsAt);
  const left = boosterDaysLeft(ends);
  const when = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(ends);
  const label = left > 0 ? `Booster · ${left} hari` : "Booster · kembali";
  return (
    <Tooltip
      title={
        left > 0
          ? `Profil ${booster.profile} sampai ${when}. Paket tidak berubah.`
          : `Waktu booster habis. Profil kembali ke semula.`
      }
    >
      <span className="cursor-help rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
        {label}
      </span>
    </Tooltip>
  );
}

function formatTglBerlangganan(tgl: string | null | undefined): string | null {
  if (!tgl?.trim()) return null;
  const [y, m, d] = tgl.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function TglBerlanggananUnderNama({
  pelanggan,
}: {
  pelanggan?: { tgl?: string | null; paket?: unknown } | null;
}) {
  if (!pelanggan?.paket) return null;
  const label = formatTglBerlangganan(pelanggan.tgl);
  if (!label) return null;
  return (
    <span className="block text-[11px] font-normal leading-snug text-slate-500 normal-case tracking-normal">
      Tgl berlangganan: {label}
    </span>
  );
}

function AutoFilledBadge({
  at,
}: {
  at?: Date | string | null;
}) {
  if (!at) return null;
  const label = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(at));
  return (
    <Tooltip
      title={`Diisi otomatis ${label}. Simpan perubahan data pelanggan untuk menghapus tanda ini.`}
      arrow
    >
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
        Auto isi
      </span>
    </Tooltip>
  );
}

export default function Data({
  data,
  paket,
  syncTime,
  router,
  ppn,
  role,
  freeQuotaStats,
  packageChangeQuota,
}: {
  data: GetPPP["data"] | undefined;
  paket: Paket[] | undefined;
  syncTime: GetPPP["syncTime"] | undefined;
  router: Pick<
    Router,
    "id" | "lat" | "lng" | "nama" | "os_version" | "isolirProfileName" | "userId"
  > | undefined;
  ppn: number | null | undefined;
  role: RoleName;
  freeQuotaStats?: PppFreeCustomerQuotaStats;
  packageChangeQuota?: {
    limit: number | null;
    upgradeUsed: number;
    downgradeUsed: number;
  } | null;
}) {
  const { refresh } = useRouter();
  const ppnPct = ppn ?? 11;
  const isolirCtx = useMemo(
    () => ({ isolirProfileName: router?.isolirProfileName }),
    [router?.isolirProfileName]
  );
  const pppIsIsolir = useCallback(
    (val: ArrayElementType<GetPPP["data"]>) => isPppIsolir(val, isolirCtx),
    [isolirCtx]
  );
  const canChangePackage = useCallback(
    (val: ArrayElementType<GetPPP["data"]>) =>
      Boolean(val.on_router && val.pelanggan && !val.pelanggan.stop && !pppIsIsolir(val)),
    [pppIsIsolir]
  );
  const applyPackageChange = useCallback((result: PackageChangeResult) => {
    const isBooster = result.direction === "booster";
    setTableData((rows) =>
      rows?.map((item) => {
        if (item.id !== result.secretId || !item.pelanggan) return item;
        return {
          ...item,
          profile: result.profile,
          active_records: result.kicked ? null : item.active_records,
          booster: isBooster
            ? {
                profile: result.booster?.profile ?? result.profile,
                endsAt: result.booster?.endsAt ?? new Date().toISOString(),
                days: result.booster?.days ?? 1,
              }
            : null,
          packageChange:
            isBooster || role === "Superadmin"
              ? item.packageChange
              : {
                  direction: result.direction === "downgrade" ? "downgrade" : "upgrade",
                  created: new Date().toISOString(),
                },
          pelanggan: isBooster
            ? item.pelanggan
            : {
                ...item.pelanggan,
                paketId: result.paket.id,
                paket: {
                  ...item.pelanggan.paket,
                  nama: result.paket.nama,
                  kapasitas: result.paket.kapasitas,
                  harga: result.paket.harga,
                },
              },
        };
      })
    );
    if (!isBooster && role !== "Superadmin") {
      setQuotaLive((current) => {
        if (!current) return current;
        if (result.direction === "downgrade") {
          return { ...current, downgradeUsed: current.downgradeUsed + 1 };
        }
        return { ...current, upgradeUsed: current.upgradeUsed + 1 };
      });
    }
  }, [role]);
  const [mutating, setMutating] = useState(false);
  const [syncPhase, setSyncPhase] = useState<"idle" | "syncing" | "refreshing">(
    "idle"
  );
  const [tableData, setTableData] = useState(data);
  const tableSyncMsRef = useRef(
    syncTime?.updated ? new Date(syncTime.updated).getTime() : 0
  );
  const [addDialog, setAddDialog] = useState(false);
  const [addPelanggan, setAddPelanggan] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pinRow, setPinRow] = useState<ArrayElementType<GetPPP["data"]> | null>(
    null
  );
  const [packageChange, setPackageChange] = useState<
    ArrayElementType<GetPPP["data"]> | null
  >(null);
  const [quotaLive, setQuotaLive] = useState(packageChangeQuota ?? null);
  useEffect(() => {
    setQuotaLive(packageChangeQuota ?? null);
  }, [packageChangeQuota]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [displaySyncTime, setDisplaySyncTime] = useState(syncTime);
  const [autoSyncNotice, setAutoSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    const incoming = syncTime?.updated ? new Date(syncTime.updated).getTime() : 0;
    if (incoming < tableSyncMsRef.current) return;
    tableSyncMsRef.current = incoming;
    setTableData(data);
  }, [data, syncTime]);

  useEffect(() => {
    if (!syncTime?.updated) {
      setDisplaySyncTime(syncTime);
      return;
    }
    setDisplaySyncTime((prev) => {
      if (!prev?.updated) return syncTime;
      const prevMs = new Date(prev.updated).getTime();
      const nextMs = new Date(syncTime.updated).getTime();
      return nextMs >= prevMs ? syncTime : prev;
    });
  }, [syncTime]);

  const applySyncTimeFromResponse = useCallback(
    (resp: ExecutePppSyncResult) => {
      if (!isPppSyncError(resp) && resp.data.syncTime) {
        setDisplaySyncTime(resp.data.syncTime);
      }
    },
    []
  );

  const applyRefreshedTable = useCallback(
    (refreshed: Awaited<ReturnType<typeof refreshPppTableAfterSync>>) => {
      setTableData(refreshed.data);
      if (refreshed.syncTime?.updated) {
        tableSyncMsRef.current = new Date(refreshed.syncTime.updated).getTime();
        setDisplaySyncTime(refreshed.syncTime);
      }
    },
    []
  );

  /**
   * Setelah sync sukses, tabel diperbarui dari data yang baru diambil.
   * Auto sync tidak memanggil refresh halaman: refresh menurunkan komponen,
   * menghapus tanda "sudah sinkron", lalu sinkron dan muat ulang tabel berulang.
   */
  const completePppSyncRefresh = useCallback(
    async (routerId: number, source: "auto" | "manual") => {
      setSyncPhase("refreshing");
      try {
        const refreshed = await refreshPppTableAfterSync(routerId, source);
        applyRefreshedTable(refreshed);
        if (source === "manual") refresh();
        return refreshed;
      } finally {
        setSyncPhase("idle");
      }
    },
    [applyRefreshedTable, refresh]
  );

  const uniqueProfiles = useMemo(() => {
    if (!tableData) return [];
    const profiles = new Set<string>();
    tableData.forEach((item) => {
        if (item.profile) profiles.add(item.profile);
    });
    return Array.from(profiles);
  }, [tableData]);

  /** Sinkron penuh sama seperti tombol, segera setelah halaman tampil. */
  const AUTO_PPP_SYNC_DELAY_MS = 400;

  useEffect(() => {
    if (!router?.id) return;

    logPppPageEvent("page_load", { routerId: router.id });

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (!claimPppAutoSync(router.id)) return;

      void (async () => {
        logPppPageEvent("auto_sync_start", { routerId: router.id });
        setSyncPhase("syncing");
        let syncOk = false;
        try {
          void getPPPProfiles(router.id).then((res) => {
            if (!cancelled && "data" in res && res.data) setProfiles(res.data);
          });

          const resp = await syncPPP(router.id);
          if (cancelled) return;
          if (isPppSyncError(resp)) {
            throw new Error(
              getErrorMessage(resp.error, "Sinkronisasi otomatis gagal.")
            );
          }
          applySyncTimeFromResponse(resp);
          const addNote =
            resp.data.addTotal != null && resp.data.addTotal > 0
              ? ` Terdapat ${resp.data.addTotal} data baru.`
              : "";
          const successMsg = `Auto sinkron PPPoE berhasil.${addNote}`;
          setAutoSyncNotice(successMsg);
          toast.success(successMsg, { duration: 5000 });

          if (cancelled) return;
          await completePppSyncRefresh(router.id, "auto");
          syncOk = true;
          logPppPageEvent("auto_sync_success", { routerId: router.id });
        } catch (err) {
          if (cancelled) return;
          logPppPageEvent("auto_sync_error", {
            routerId: router.id,
            error: getErrorMessage(err),
          });
          setAutoSyncNotice(null);
          toast.error(
            getErrorMessage(err, "Terjadi kesalahan pada server"),
            {}
          );
        } finally {
          setSyncPhase("idle");
          releasePppAutoSync(
            router.id,
            cancelled ? "cancelled" : syncOk ? "success" : "error"
          );
        }
      })();
    }, AUTO_PPP_SYNC_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [router?.id, applySyncTimeFromResponse, completePppSyncRefresh]);

  const syncHandler = useCallback(async () => {
    if (!router) return;
    setMutating(true);
    setSyncPhase("syncing");
    logPppPageEvent("manual_sync_start", { routerId: router.id });
    const toastLoad = toast.loading("Menyinkron PPPoE...");
    let syncOk = false;
    try {
      const resp = await syncPPP(router.id);
      if (isPppSyncError(resp)) {
        throw new Error(
          getErrorMessage(resp.error, "Gagal mengsinkronisasi.")
        );
      }
      applySyncTimeFromResponse(resp);
      await completePppSyncRefresh(router.id, "manual");
      syncOk = true;
      const textToast =
        resp.data.addTotal !== 0 && resp.data.addTotal
          ? ` Terdapat ${resp.data.addTotal} data baru yang telah ditambahkan.`
          : "";
      toast.success(
        "Sinkronisasi data berhasil!" + (textToast ? textToast : ""),
        {
          id: toastLoad,
        }
      );
      logPppPageEvent("manual_sync_success", { routerId: router.id });
    } catch (err) {
      console.error(getErrorMessage(err));
      logPppPageEvent("manual_sync_error", {
        routerId: router.id,
        error: getErrorMessage(err),
      });
      toast.error(getErrorMessage(err, "Terjadi kesalahan pada server"), {
        id: toastLoad,
      });
    } finally {
      setMutating(false);
      setSyncPhase("idle");
      if (!syncOk) {
        refresh();
      }
    }
  }, [router, refresh, applySyncTimeFromResponse, completePppSyncRefresh]);

  const [showBulkFillDialog, setShowBulkFillDialog] = useState(false);
  const [showBulkTglIsolir, setShowBulkTglIsolir] = useState(false);
  const [showBulkTglBerlangganan, setShowBulkTglBerlangganan] = useState(false);
  const [showBulkPetugas, setShowBulkPetugas] = useState(false);
  const [petugasMode, setPetugasMode] = useState<BulkPetugasMode | null>(null);
  const [selectedPelangganIds, setSelectedPelangganIds] = useState<number[]>([]);
  const [penagihOptions, setPenagihOptions] = useState<
    { id: number; nama: string; aktif: boolean }[]
  >([]);
  const [loadingPenagihOptions, setLoadingPenagihOptions] = useState(false);
  const canAssignPenagih = canAccessPenagihan(role);

  const registeredPelangganCount = useMemo(
    () => (data ?? []).filter((row) => row.pelanggan).length,
    [data]
  );
  const subscriptionMonths = useMemo(
    () =>
      listSubscriptionMonths(
        (tableData ?? [])
          .map((row) => row.pelanggan?.tgl)
          .filter((tgl): tgl is string => Boolean(tgl))
      ),
    [tableData]
  );

  const bulkTglIsolirHandler = useCallback(
    async (day: number) => {
      if (!router) return;
      setMutating(true);
      const toastLoad = toast.loading("Menyimpan tanggal isolir...");
      try {
        const resp = await fetch(
          `/api/router/${router.id}/ppp/bulk-tgl-isolir`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tgl_isolir: day }),
          }
        );
        const json = (await resp.json()) as { message?: string; error?: string };
        if (!resp.ok) {
          throw new Error(getErrorMessage(json, "Gagal menyimpan tanggal isolir"));
        }
        toast.success(json.message ?? "Tanggal isolir tersimpan.", {
          id: toastLoad,
        });
        setShowBulkTglIsolir(false);
        refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, "Gagal menyimpan tanggal isolir"), {
          id: toastLoad,
        });
      } finally {
        setMutating(false);
      }
    },
    [router, refresh]
  );

  const bulkTglBerlanggananHandler = useCallback(
    async (dari: string, ke: string, hari: number | null) => {
      if (!router) return;
      setMutating(true);
      const toastLoad = toast.loading("Menyimpan tanggal berlangganan...");
      try {
        const resp = await fetch(
          `/api/router/${router.id}/ppp/bulk-tgl-berlangganan`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dari, ke, hari }),
          }
        );
        const json = (await resp.json()) as { message?: string; error?: string };
        if (!resp.ok) {
          throw new Error(
            getErrorMessage(json, "Gagal menyimpan bulan berlangganan")
          );
        }
        toast.success(json.message ?? "Bulan berlangganan tersimpan.", {
          id: toastLoad,
        });
        setShowBulkTglBerlangganan(false);
        refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, "Gagal menyimpan bulan berlangganan"), {
          id: toastLoad,
        });
      } finally {
        setMutating(false);
      }
    },
    [router, refresh]
  );

  const startSelectingPetugas = useCallback(
    (mode: BulkPetugasMode) => {
      if (!router?.userId) {
        toast.error("Router belum terkait mitra");
        return;
      }
      setPetugasMode(mode);
      setSelectedPelangganIds([]);
      setPage(1);
    },
    [router?.userId]
  );

  const cancelSelectingPetugas = useCallback(() => {
    setPetugasMode(null);
    setSelectedPelangganIds([]);
    setShowBulkPetugas(false);
    setPage(1);
  }, []);

  const openBulkPetugas = useCallback(async () => {
    if (!router?.userId) {
      toast.error("Router belum terkait mitra");
      return;
    }
    if (selectedPelangganIds.length === 0) {
      toast.error("Centang pelanggan dulu");
      return;
    }
    if (selectedPelangganIds.length > 500) {
      toast.error("Maksimal 500 pelanggan sekaligus");
      return;
    }
    setShowBulkPetugas(true);
    if (petugasMode === "hapus") {
      setPenagihOptions([]);
      setLoadingPenagihOptions(false);
      return;
    }
    setLoadingPenagihOptions(true);
    try {
      const res = await fetch(`/api/penagih?mitraId=${router.userId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat petugas");
      setPenagihOptions(
        Array.isArray(json.penagih)
          ? (json.penagih as { id: number; nama: string; aktif: boolean }[])
          : []
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal memuat petugas"));
      setShowBulkPetugas(false);
    } finally {
      setLoadingPenagihOptions(false);
    }
  }, [router?.userId, selectedPelangganIds.length, petugasMode]);

  const bulkPetugasHandler = useCallback(
    async (penagihId: number | null) => {
      if (!router?.userId) return;
      if (petugasMode === "tambah" && penagihId == null) {
        toast.error("Pilih petugas");
        return;
      }
      const isHapus = petugasMode === "hapus" || penagihId == null;
      setMutating(true);
      const toastLoad = toast.loading(
        isHapus ? "Menghapus petugas..." : "Menyimpan petugas..."
      );
      try {
        const res = await fetch("/api/penagih/penugasan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isHapus
              ? {
                  mitraId: router.userId,
                  hapus: true,
                  pelangganIds: selectedPelangganIds,
                }
              : {
                  mitraId: router.userId,
                  penagihId,
                  pelangganIds: selectedPelangganIds,
                }
          ),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            getErrorMessage(
              json,
              isHapus ? "Gagal menghapus petugas" : "Gagal menyimpan petugas"
            )
          );
        }
        toast.success(
          isHapus
            ? `${json.updated ?? selectedPelangganIds.length} petugas dihapus`
            : petugasMode === "tambah"
              ? `${json.updated ?? selectedPelangganIds.length} petugas ditambahkan`
              : `${json.updated ?? selectedPelangganIds.length} petugas diubah`,
          { id: toastLoad }
        );
        setSelectedPelangganIds([]);
        setShowBulkPetugas(false);
        setPetugasMode(null);
        await revalidatePPP();
        refresh();
      } catch (err) {
        toast.error(
          getErrorMessage(
            err,
            isHapus ? "Gagal menghapus petugas" : "Gagal menyimpan petugas"
          ),
          { id: toastLoad }
        );
      } finally {
        setMutating(false);
      }
    },
    [router?.userId, selectedPelangganIds, refresh, petugasMode]
  );

  const bulkFillHandler = useCallback(
    async (defaultPaketId: number | null) => {
      if (!router) return;
      setMutating(true);
      const toastLoad = toast.loading("Mengisi data pelanggan...");
      try {
        const resp = await fetch(
          `/api/router/${router.id}/ppp/bulk-fill-pelanggan`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              defaultPaketId != null ? { defaultPaketId } : {}
            ),
          }
        );
        const json = (await resp.json()) as {
          message?: string;
          error?: string;
          data?: {
            skips?: {
              free_customer_quota_exceeded?: number;
              package_profile_mismatch?: number;
              free_package_not_allowed_as_fallback?: number;
              ambiguous_package_profile?: number;
            };
            skipNames?: {
              package_profile_mismatch?: string[];
              free_package_not_allowed_as_fallback?: string[];
              ambiguous_package_profile?: string[];
            };
          };
        };
        if (!resp.ok) {
          throw new Error(
            getErrorMessage(json, "Gagal mengisi data")
          );
        }
        toast.success(json.message ?? "Auto Isi selesai.", {
          id: toastLoad,
          duration:
            (json.data?.skips?.free_customer_quota_exceeded ?? 0) > 0
              ? 8000
              : 4000,
        });
        const profileMismatch =
          (json.data?.skips?.package_profile_mismatch ?? 0) +
          (json.data?.skips?.free_package_not_allowed_as_fallback ?? 0) +
          (json.data?.skips?.ambiguous_package_profile ?? 0);
        if (profileMismatch > 0 && json.data) {
          const names = [
            ...(json.data.skipNames?.package_profile_mismatch ?? []),
            ...(json.data.skipNames?.free_package_not_allowed_as_fallback ?? []),
            ...(json.data.skipNames?.ambiguous_package_profile ?? []),
          ];
          toast(
            `${profileMismatch} PPP dilewati (profil/paket tidak cocok): ${names.slice(0, 5).join(", ")}${
              names.length > 5 ? "…" : ""
            }`,
            { icon: "⚠️", duration: 6000 }
          );
        }
        setShowBulkFillDialog(false);
        if (router) {
          const refreshed = await refreshPppTableAfterSync(router.id, "manual");
          applyRefreshedTable(refreshed);
        }
        refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, "Terjadi kesalahan"), {
          id: toastLoad,
        });
      } finally {
        setMutating(false);
      }
    },
    [router, refresh, applyRefreshedTable]
  );

  const importCsvRef = useRef<HTMLInputElement>(null);

  const importCsvHandler = useCallback(
    async (file: File | undefined) => {
      if (!router || !file) return;
      if (file.size > 1_000_000) {
        toast.error("File CSV terlalu besar.");
        return;
      }
      setMutating(true);
      const toastLoad = toast.loading("Mengimpor CSV...");
      try {
        const csv = await file.text();
        const resp = await fetch(
          `/api/router/${router.id}/ppp/import-pelanggan`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csv }),
          }
        );
        const json = (await resp.json()) as {
          message?: string;
          error?: string;
          data?: { updated?: number };
        };
        if (!resp.ok) {
          throw new Error(getErrorMessage(json, "Gagal mengimpor CSV"));
        }
        const summary = json.message ?? "Impor selesai.";
        if ((json.data?.updated ?? 0) > 0) {
          toast.success(summary, { id: toastLoad, duration: 8000 });
        } else {
          toast(summary, { id: toastLoad, duration: 8000 });
        }
        const refreshed = await refreshPppTableAfterSync(router.id, "manual");
        applyRefreshedTable(refreshed);
        refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, "Terjadi kesalahan"), {
          id: toastLoad,
        });
      } finally {
        setMutating(false);
        if (importCsvRef.current) importCsvRef.current.value = "";
      }
    },
    [router, refresh, applyRefreshedTable]
  );

  const filterPPPData = useMemo(() => {
    const semua = tableData?.length ?? 0;
    const aktif =
      tableData?.filter(
        (val) =>
          val.active_records &&
          !val.pelanggan?.stop &&
          !isPppSecretDisabled(val)
      ).length ?? 0;
    const nonaktif =
      tableData?.filter(
        (val) =>
          !val.active_records &&
          !pppIsIsolir(val) &&
          !isPppSecretDisabled(val) &&
          !val.pelanggan?.stop &&
          val.pelanggan
      ).length ?? 0;
    const belum = tableData?.filter((val) => !val.pelanggan).length ?? 0;
    const auto =
      tableData?.filter((val) => isPelangganAutoFilled(val.pelanggan)).length ?? 0;
    const isolir = tableData?.filter((val) => pppIsIsolir(val)).length ?? 0;
    const berhenti = tableData?.filter((val) => val.pelanggan?.stop).length ?? 0;
    return {
      semua,
      aktif,
      nonaktif,
      belum,
      auto,
      isolir,
      berhenti,
    };
  }, [tableData, pppIsIsolir]);

  const bulkNonaktifCount = useMemo(
    () =>
      tableData
        ? tableData.filter((v) => isPppNonaktifTab(v, router?.isolirProfileName)).length
        : 0,
    [tableData, router?.isolirProfileName]
  );
  const bulkBerhentiCount = useMemo(
    () => (tableData ? tableData.filter(isPppBerhentiTab).length : 0),
    [tableData]
  );
  const bulkOffRouterCount = useMemo(
    () => (tableData ? tableData.filter((v) => !v.on_router).length : 0),
    [tableData]
  );

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

  const [hapus, hapusDispatch] = useReducer(
    (
      state: { modal: boolean; data?: ArrayElementType<GetPPP["data"]> },
      action: EditAction | { action: "empty" }
    ) => {
      switch (action.action) {
        case "open":
          return { ...state, modal: true, data: action.data };
        case "close":
          return { ...state, modal: false };
        case "empty":
          return { modal: state.modal };
        case "data":
          return { ...state, data: action.data };
        default:
          return state;
      }
    },
    {
      modal: false,
    }
  );

  const [bulkHapusScope, setBulkHapusScope] = useState<BulkPppScope | null>(
    null
  );

  const handleDelete = async () => {
    if (!hapus.data) return;
    setMutating(true);
    const toastLoad = toast.loading("Menghapus...");
    try {
      const resp = await fetch(`/api/router/ppp/delete/${hapus.data.id}`, {
        method: "DELETE",
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(getErrorMessage(json, "Gagal menghapus"));
      }
      toast.success("Berhasil menghapus user PPP", { id: toastLoad });
      hapusDispatch({ action: "close" });
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal menghapus"), { id: toastLoad });
    } finally {
      setMutating(false);
    }
  };

  const handleBulkDeletePpp = async () => {
    if (!router || !bulkHapusScope) return;
    const scope = bulkHapusScope;
    setMutating(true);
    const toastLoad = toast.loading(
      scope === "nonaktif"
        ? "Menghapus user PPP Nonaktif..."
        : scope === "berhenti"
          ? "Menghapus user PPP Berhenti..."
          : "Menghapus user PPP hilang di Mikrotik..."
    );
    try {
      const pathSegment =
        scope === "nonaktif"
          ? "bulk-delete-nonaktif"
          : scope === "berhenti"
            ? "bulk-delete-berhenti"
            : "bulk-delete-off-router";
      const resp = await fetch(
        `/api/router/${router.id}/ppp/${pathSegment}`,
        { method: "POST" }
      );
      let json: {
        message?: string;
        deleted?: number;
        failed?: { id: number; name: string; error: string }[];
      } = {};
      try {
        json = await resp.json();
      } catch {
        json = {};
      }
      if (!resp.ok) {
        throw new Error(getErrorMessage(json, "Gagal menghapus"));
      }
      toast.success(json.message || "Berhasil", { id: toastLoad });
      if (json.failed && json.failed.length > 0) {
        const sample = json.failed
          .slice(0, 5)
          .map((f) => f.name)
          .join(", ");
        toast.error(
          `${json.failed.length} gagal${sample ? `: ${sample}` : ""}${
            json.failed.length > 5 ? "…" : ""
          }`,
          { duration: 6000 }
        );
      }
      setBulkHapusScope(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal menghapus"), { id: toastLoad });
    } finally {
      setMutating(false);
    }
  };

  const [queryPaket, setQueryPaket] = useState("");
  const [selPaket, setSelPaket] = useState<number>(0);
  const [defPaket] = useState({ id: 0, nama: "Semua Paket" });
  /** Hindari mismatch id Headless UI (useId) antara SSR dan client. */
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  const paketDipakai = useMemo(() => {
    const byId = new Map<number, Paket>();
    for (const row of tableData ?? []) {
      const id = row.pelanggan?.paketId;
      if (!id || byId.has(id)) continue;
      const full = paket?.find((item) => item.id === id);
      if (full) byId.set(id, full);
    }
    return [...byId.values()].sort((a, b) =>
      a.nama.localeCompare(b.nama, "id")
    );
  }, [tableData, paket]);

  useEffect(() => {
    if (selPaket === 0) return;
    if (!paketDipakai.some((item) => item.id === selPaket)) setSelPaket(0);
  }, [paketDipakai, selPaket]);

  const fusePaket = useMemo(() => new Fuse(paketDipakai, {
    keys: ["nama", "kapasitas", "harga"],
    threshold: 0.3,
  }), [paketDipakai]);

  const filteredPaket = useMemo(() => {
    return queryPaket === ""
      ? paketDipakai
      : fusePaket.search(queryPaket).map((val) => val.item);
  }, [paketDipakai, queryPaket, fusePaket]);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filter, setFilter] = useState<Tabs>("Semua");
  const [filteredData, setFilteredData] = useState<typeof tableData>(tableData);
  const dataFilteredParser = useCallback(() => {
    switch (filter) {
      case "Semua":
      default:
        setFilteredData(tableData);
        break;
      case "Aktif":
        setFilteredData(
          tableData?.filter(
            (val) =>
              val.active_records &&
              !val.pelanggan?.stop &&
              !isPppSecretDisabled(val)
          )
        );
        break;
      case "Nonaktif":
        setFilteredData(
          tableData?.filter(
            (val) =>
              !val.active_records &&
              !pppIsIsolir(val) &&
              !isPppSecretDisabled(val) &&
              !val.pelanggan?.stop &&
              val.pelanggan
          )
        );
        break;
      case "Isolir":
        setFilteredData(tableData?.filter((val) => pppIsIsolir(val)));
        break;
      case "Berhenti":
        setFilteredData(tableData?.filter((val) => val.pelanggan?.stop));
        break;
      case "Belum":
        setFilteredData(tableData?.filter((val) => !val.pelanggan));
        break;
      case "Auto":
        setFilteredData(
          tableData?.filter((val) => isPelangganAutoFilled(val.pelanggan))
        );
        break;
    }
  }, [tableData, filter, pppIsIsolir]);
  useEffect(() => {
    dataFilteredParser();
  }, [dataFilteredParser]);

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const fuse = useMemo(() => new Fuse(filteredData || [], {
    keys: ["name", "pelanggan.nama", "pelanggan.penagihNama", "comment"],
    threshold: 0.3,
  }), [filteredData]);

  const isPelangganEligibleForPetugas = useCallback(
    (pelanggan: { id: number; penagihId: number | null } | null | undefined) => {
      if (!pelanggan || !petugasMode) return false;
      if (petugasMode === "tambah") return pelanggan.penagihId == null;
      // ubah & hapus: hanya yang sudah punya petugas
      return pelanggan.penagihId != null;
    },
    [petugasMode]
  );

  const filteredAndSearchedData = useMemo(() => {
    let parsed =
      query === "" ? filteredData : fuse.search(query).map((val) => val.item);
    if (selPaket !== 0) {
      parsed = parsed?.filter((val) => val.pelanggan?.paketId === selPaket);
    }
    if (petugasMode) {
      parsed = (parsed || []).filter((val) =>
        isPelangganEligibleForPetugas(val.pelanggan)
      );
    }
    return parsed || [];
  }, [
    filteredData,
    query,
    selPaket,
    fuse,
    petugasMode,
    isPelangganEligibleForPetugas,
  ]);

  const totalPages = Math.ceil((filteredAndSearchedData.length || 1) / limit);

  const isBusy = mutating || syncPhase !== "idle";

  const parsedData = useMemo(() => {
    return filteredAndSearchedData.slice((page - 1) * limit, page * limit);
  }, [filteredAndSearchedData, page, limit]);

  const pagePelangganIds = useMemo(
    () =>
      (parsedData ?? []).flatMap((row) =>
        row.pelanggan ? [row.pelanggan.id] : []
      ),
    [parsedData]
  );
  const allPageSelected =
    pagePelangganIds.length > 0 &&
    pagePelangganIds.every((id) => selectedPelangganIds.includes(id));
  const tableColSpan = petugasMode ? 12 : 11;

  return (
    <>
      <section className="md:grid md:grid-cols-3 md:gap-4 gap-2 pb-4 w-full">
        <div className="flex gap-1.5 items-center w-full">
            <Search
              isSearchParams={false}
              queryState={query}
              handleSearch={handleSearch}
            />
            <Tooltip title="Sinkron PPPoE dari Mikrotik">
              <span className="inline-block shrink-0">
                <Button
                  type="button"
                  color="cyan100"
                  disabled={isBusy}
                  className="text-xs py-0.5 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                  onClick={syncHandler}
                >
                  <TbRefresh
                    className={cn(
                      "size-3.5 shrink-0",
                      syncPhase !== "idle" && "animate-spin"
                    )}
                  />
                  {syncPhase === "syncing"
                    ? "Sinkron…"
                    : syncPhase === "refreshing"
                      ? "Memperbarui…"
                      : "Sinkron PPPoE"}
                </Button>
              </span>
            </Tooltip>
            {filterPPPData.belum > 0 ? (
              <Tooltip title="Isi otomatis data pelanggan untuk PPP yang belum terdaftar">
                <span className="inline-block shrink-0">
                  <Button
                    type="button"
                    color="sky"
                    disabled={mutating}
                    className="text-xs py-0.5 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                    onClick={() => {
                      if (!paket || paket.length === 0) {
                        toast.error(AUTO_FILL_NO_PACKAGE_MESSAGE, {
                          duration: 8000,
                        });
                        return;
                      }
                      setShowBulkFillDialog(true);
                    }}
                  >
                    <TbUserPlus className="size-3.5 shrink-0" />
                    Isi data ({filterPPPData.belum})
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            {router ? (
              <>
                <input
                  ref={importCsvRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    void importCsvHandler(file);
                  }}
                />
                <Tooltip title="Impor nama, nomor HP, dan alamat untuk pelanggan yang masih auto isi. Username CSV harus sama dengan username PPPoE.">
                  <span className="inline-block shrink-0">
                    <Button
                      type="button"
                      color="sky"
                      disabled={isBusy}
                      className="text-xs py-0.5 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                      onClick={() => importCsvRef.current?.click()}
                    >
                      <TbFileImport className="size-3.5 shrink-0" />
                      Impor CSV
                    </Button>
                  </span>
                </Tooltip>
              </>
            ) : null}
            {router ? (
              <IsolirSetupDialog
                router={router}
                canManage={role === "Superadmin" || role === "Admin"}
              />
            ) : null}
        </div>
        <div className="flex flex-col gap-2 w-full min-w-0">
          <FilterPPP
            filter={filter}
            setFilter={setFilter}
            setPage={setPage}
            data={filterPPPData}
          />
          <div className="flex gap-1.5 shrink-0 flex-wrap justify-end sm:justify-start md:justify-end">
              {role === "Superadmin" && router && bulkNonaktifCount > 0 && (
                <Tooltip title="Hapus sekaligus semua user di tab Nonaktif (offline, bukan isolir, belum berhenti). Isolir, Berhenti, Belum, Aktif tidak ikut.">
                  <span className="inline-block">
                    <Button
                      type="button"
                      disabled={mutating}
                      color="slatesky"
                      className="text-xs py-1 px-2"
                      onClick={() => setBulkHapusScope("nonaktif")}
                    >
                      Hapus Nonaktif ({bulkNonaktifCount})
                    </Button>
                  </span>
                </Tooltip>
              )}
              {role === "Superadmin" && router && bulkBerhentiCount > 0 && (
                <Tooltip title="Hapus sekaligus semua user di tab Berhenti. Kategori lain tidak ikut.">
                  <span className="inline-block">
                    <Button
                      type="button"
                      disabled={mutating}
                      color="slatesky"
                      className="text-xs py-1 px-2"
                      onClick={() => setBulkHapusScope("berhenti")}
                    >
                      Hapus Berhenti ({bulkBerhentiCount})
                    </Button>
                  </span>
                </Tooltip>
              )}
              {role === "Superadmin" && router && bulkOffRouterCount > 0 && (
                <Tooltip title="Hapus sekaligus semua user PPP yang sudah tidak ada di Mikrotik (nama merah). Semua tab ikut.">
                  <span className="inline-block">
                    <Button
                      type="button"
                      disabled={mutating}
                      color="red"
                      className="text-xs py-1 px-2"
                      onClick={() => setBulkHapusScope("off-router")}
                    >
                      Hapus Hilang di Mikrotik ({bulkOffRouterCount})
                    </Button>
                  </span>
                </Tooltip>
              )}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:justify-end flex-wrap">
          {freeQuotaStats ? (
            <PppFreeQuotaBadge stats={freeQuotaStats} />
          ) : null}
          <div className="min-w-0 flex-1 md:flex-initial md:max-w-60">
          {!clientReady ? (
            <div
              className={cn(
                "w-full rounded-lg border-none bg-slate-200/80 py-1.5 pr-8 pl-3 text-sm/6 text-gray-900",
                "min-h-[2.25rem]"
              )}
              aria-hidden
            >
              {selPaket === 0
                ? defPaket.nama
                : paket?.find((p) => p.id === selPaket)?.nama ?? defPaket.nama}
            </div>
          ) : (
          <Combobox
            value={
              selPaket === 0
                ? defPaket
                : paket?.find((paketVal) => paketVal.id === selPaket)
            }
            onChange={(changeVal) => {
              setSelPaket(changeVal?.id || 0);
              setPage(1);
            }}
            onClose={() => setQueryPaket("")}
          >
            <ComboboxButton className="relative w-full">
              <ComboboxInput
                className={cn(
                  "w-full rounded-lg border-none bg-slate-200/80 py-1.5 pr-8 pl-3 text-sm/6",
                  "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                )}
                displayValue={(displayValue: Paket | null) =>
                  displayValue ? displayValue?.nama : ""
                }
                onChange={(event) => setQueryPaket(event.target.value)}
              />
              <div className="group absolute top-1/2 -translate-y-1/2 right-0 px-2.5">
                <FaChevronDown className="size-4 fill-gray-900/60 group-data-[hover]:fill-gray-900" />
              </div>
            </ComboboxButton>

            <ComboboxOptions
              transition
              anchor="bottom"
              className={cn(
                "w-[var(--input-width)] rounded-xl border border-slate-300/80 bg-slate-200 p-1 [--anchor-gap:var(--spacing-1)] empty:invisible",
                "transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
              )}
            >
              <ComboboxOption
                value={defPaket}
                className="group flex justify-between cursor-pointer items-center gap-2 rounded-lg py-1.5 px-3 select-none data-[hover]:bg-slate-200/30 data-[active]:bg-slate-100"
              >
                <div>
                  <p className="text-sm/6 text-gray-900">Semua Paket</p>
                </div>
                <FaCheck className="invisible size-4 fill-green-600 group-data-[selected]:visible" />
              </ComboboxOption>
              {filteredPaket?.map((b) => (
                <ComboboxOption
                  key={"paket-combobox-" + b.id}
                  value={b}
                  className="group flex justify-between cursor-pointer items-center gap-2 rounded-lg py-1.5 px-3 select-none data-[hover]:bg-slate-200/30 data-[active]:bg-slate-100"
                >
                  <div>
                    <p className="text-sm/6 text-gray-900">{b.nama}</p>
                    <p className="text-sm/7 text-gray-900">
                      {`${b.kapasitas} Mb - ${nominalPaketForDisplay(
                        b,
                        ppnPct
                      ).toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}`}
                    </p>
                  </div>
                  <FaCheck className="invisible size-4 fill-green-600 group-data-[selected]:visible" />
                </ComboboxOption>
              ))}
            </ComboboxOptions>
          </Combobox>
          )}
          </div>
          {router ? (
            <Tooltip title="Performa router">
              <Link
                href={`/router/${router.id}`}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-200/80 dark:bg-theme-elevated px-3 py-1.5",
                  "text-slate-700 dark:text-theme-fg hover:bg-slate-300/80 dark:hover:bg-theme-muted transition-colors text-sm font-medium"
                )}
              >
                <TbHeartRateMonitor className="size-4 shrink-0" />
                <span>Performa</span>
              </Link>
            </Tooltip>
          ) : null}
        </div>

        <div className="md:col-span-3 flex flex-col md:flex-row md:justify-between gap-1 text-[10px]/3 sm:text-xs text-slate-700/90 pt-1 border-t border-slate-100">
          <p>
            Terakhir sinkron:{" "}
            {displaySyncTime?.updated
              ? new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(new Date(displaySyncTime.updated))
              : "- (Gunakan tombol Sinkron PPPoE)"}
            {displaySyncTime?.syncInProgress ? (
              <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">
                Sedang disinkronkan…
              </span>
            ) : displaySyncTime?.lastSyncStatus ? (
              <span
                className={cn(
                  "ml-2 font-medium",
                  displaySyncTime.lastSyncStatus === "success" &&
                    "text-green-700 dark:text-green-400",
                  displaySyncTime.lastSyncStatus === "failed" &&
                    "text-red-600 dark:text-red-400",
                  displaySyncTime.lastSyncStatus === "skipped" &&
                    "text-slate-500 dark:text-slate-400"
                )}
              >
                · {displaySyncTime.lastSyncStatus}
              </span>
            ) : null}
            {autoSyncNotice ? (
              <span className="ml-2 font-medium text-green-700 dark:text-green-400">
                {autoSyncNotice}
              </span>
            ) : syncPhase === "syncing" ? (
              <span className="ml-2 text-slate-600">Menyinkron dari MikroTik…</span>
            ) : syncPhase === "refreshing" ? (
              <span className="ml-2 text-slate-600">Memperbarui tabel…</span>
            ) : null}
          </p>
          {router ? (
            <div className="flex flex-row flex-wrap items-center md:justify-end gap-1.5">
              <Tooltip title="Unduh cadangan IP pool, profil, dan secret PPPoE. Cuplikan tersimpan saat sinkron, jadi tetap ada bila Mikrotik mati">
                <span className="inline-flex">
                  <Button
                    type="button"
                    color="cyan100"
                    disabled={isBusy || exporting || !router}
                    className="text-xs py-1 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                    onClick={() => {
                      if (!router?.id || exporting) return;
                      setExporting(true);
                      void (async () => {
                        try {
                          const response = await fetch(
                            `/api/router/${router.id}/ppp/export`
                          );
                          if (!response.ok) {
                            const json = await response.json().catch(() => null);
                            toast.error(
                              getErrorMessage(json, "Gagal mengunduh cadangan PPPoE")
                            );
                            return;
                          }
                          const blob = await response.blob();
                          const header =
                            response.headers.get("Content-Disposition") ?? "";
                          const match = /filename="([^"]+)"/.exec(header);
                          const filename = match?.[1] ?? "pppoe-cadangan.rsc";
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = filename;
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          URL.revokeObjectURL(url);
                          toast.success("Cadangan PPPoE terunduh");
                        } catch (err) {
                          toast.error(
                            getErrorMessage(err, "Gagal mengunduh cadangan PPPoE")
                          );
                        } finally {
                          setExporting(false);
                        }
                      })();
                    }}
                  >
                    <TbDownload className="size-3.5 shrink-0" />
                    {exporting ? "Mengunduh…" : "Export cadangan"}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Tambah pelanggan sekaligus secret PPPoE di Mikrotik">
                <span className="inline-flex">
                  <Button
                    type="button"
                    color="sky"
                    disabled={isBusy}
                    className="text-xs py-1 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                    onClick={() => setAddPelanggan(true)}
                  >
                    <TbUserPlus className="size-3.5 shrink-0" />
                    Tambah pelanggan
                  </Button>
                </span>
              </Tooltip>
              {registeredPelangganCount > 0 ? (
                <Tooltip title="Isi satu tanggal isolir untuk semua pelanggan di router ini">
                  <span className="inline-flex">
                    <Button
                      type="button"
                      color="sky"
                      disabled={isBusy}
                      className="text-xs py-1 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                      onClick={() => setShowBulkTglIsolir(true)}
                    >
                      <TbCalendar className="size-3.5 shrink-0" />
                      Tanggal isolir semua
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
              {role === "Superadmin" && subscriptionMonths.length > 0 ? (
                <Tooltip title="Pilih tanggal berlangganan yang sudah ada. Hari berbeda tetap terpisah. Bisa pindah bulan saja, atau sekalian mengganti tanggalnya.">
                  <span className="inline-flex">
                    <Button
                      type="button"
                      color="sky"
                      disabled={isBusy}
                      className="text-xs py-1 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                      onClick={() => setShowBulkTglBerlangganan(true)}
                    >
                      <TbCalendar className="size-3.5 shrink-0" />
                      Pindah bulan berlangganan
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
              {canAssignPenagih && router?.userId ? (
                petugasMode ? (
                  <span className="inline-flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      color="sky"
                      disabled={isBusy || selectedPelangganIds.length === 0}
                      className="text-xs py-1 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                      onClick={() => void openBulkPetugas()}
                    >
                      <TbUsers className="size-3.5 shrink-0" />
                      {petugasMode === "tambah"
                        ? "Tambah petugas"
                        : petugasMode === "hapus"
                          ? "Hapus petugas"
                          : "Ubah petugas"}
                      {selectedPelangganIds.length > 0
                        ? ` (${selectedPelangganIds.length})`
                        : ""}
                    </Button>
                    <Button
                      type="button"
                      color="slatesky"
                      disabled={isBusy}
                      className="text-xs py-1 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                      onClick={cancelSelectingPetugas}
                    >
                      Batal
                    </Button>
                  </span>
                ) : (
                  <Popover className="relative inline-flex">
                    <PopoverButton
                      as={Button}
                      type="button"
                      color="sky"
                      disabled={isBusy}
                      className="text-xs py-1 px-2 gap-1 rounded-md font-medium whitespace-nowrap"
                    >
                      <TbUsers className="size-3.5 shrink-0" />
                      Petugas
                    </PopoverButton>
                    <PopoverPanel
                      anchor="bottom end"
                      className="z-[1100] mt-1 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-theme-border dark:bg-theme-card"
                    >
                      {({ close }) => (
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            className="rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-theme-fg dark:hover:bg-theme-muted"
                            onClick={() => {
                              close();
                              startSelectingPetugas("hapus");
                            }}
                          >
                            Hapus petugas
                          </button>
                          <button
                            type="button"
                            className="rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-theme-fg dark:hover:bg-theme-muted"
                            onClick={() => {
                              close();
                              startSelectingPetugas("tambah");
                            }}
                          >
                            Tambah petugas
                          </button>
                          <button
                            type="button"
                            className="rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-theme-fg dark:hover:bg-theme-muted"
                            onClick={() => {
                              close();
                              startSelectingPetugas("ubah");
                            }}
                          >
                            Ubah petugas
                          </button>
                        </div>
                      )}
                    </PopoverPanel>
                  </Popover>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      <div className="relative hidden w-full pt-4 md:block">
      <PppWorkGreeting />
      <section className={cn("relative z-10 w-full overflow-x-auto rounded bg-white text-sm shadow dark:bg-theme-card")}>
        <table className="min-w-full">
          <thead>
            <tr className="divide-x divide-slate-50 bg-slate-300/70 *:px-4 *:py-2">
              {petugasMode ? (
                <td className="w-8 text-center">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua di halaman ini"
                    checked={allPageSelected}
                    disabled={pagePelangganIds.length === 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPelangganIds((prev) => [
                          ...new Set([...prev, ...pagePelangganIds]),
                        ]);
                      } else {
                        setSelectedPelangganIds((prev) =>
                          prev.filter((id) => !pagePelangganIds.includes(id))
                        );
                      }
                    }}
                  />
                </td>
              ) : null}
              <td>No.</td>
              <td>Nama</td>
              <td>PPP</td>
              {/* <td>ID PPP</td> */}
              <td>Komentar</td>
              <td>Profil</td>
              <td>Address</td>
              <td>Paket</td>
              {/* <td className="py-0.5 grid justify-center text-center text-xs/3 gap-0.5"> */}
              <td>
                <p>Harga</p>
                {/* <p>
                  Total:{" "}
                  <span className="font-medium">
                    {totalTagih?.toLocaleString("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </p> */}
              </td>
              <td>Petugas</td>
              <td>Status</td>
              <td className="text-center">Aksi</td>
            </tr>
          </thead>
          <tbody>
            {parsedData && parsedData.length > 0 ? (
              parsedData.map((val, idx) => {
                const numberPage = page <= 1 ? 0 : (page - 1) * limit;
                const nomor = idx + 1 + numberPage;
                return (
                  <tr
                    className={cn(
                      "bg-slate-50/80 hover:text-sky-600",
                      isPelangganAutoFilled(val.pelanggan) &&
                        "bg-amber-50/50 ring-1 ring-inset ring-amber-200"
                    )}
                    key={idx}
                  >
                    {petugasMode ? (
                      <td className="whitespace-pre-wrap px-4 py-2 text-center">
                        {val.pelanggan ? (
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${val.pelanggan.nama}`}
                          checked={selectedPelangganIds.includes(val.pelanggan.id)}
                          onChange={(e) => {
                            const id = val.pelanggan?.id;
                            if (id == null) return;
                            setSelectedPelangganIds((prev) =>
                              e.target.checked
                                ? prev.includes(id)
                                  ? prev
                                  : [...prev, id]
                                : prev.filter((item) => item !== id)
                            );
                          }}
                        />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {nomor + "."}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {val.pelanggan?.nama &&
                          val.pelanggan.pembayaran.length === 0 ? (
                            <Tooltip title="Belum ada tagihan bulan ini">
                              <span className="text-green-600 font-bold cursor-help">
                                {val.pelanggan.nama}
                              </span>
                            </Tooltip>
                          ) : (
                            <span>{val.pelanggan?.nama}</span>
                          )}
                          <AutoFilledBadge at={val.pelanggan?.autoFilledAt} />
                          <PackageChangeMark mark={val.packageChange} />
                          <BoosterMark booster={val.booster} />
                        </div>
                        <TglBerlanggananUnderNama pelanggan={val.pelanggan} />
                      </div>
                    </td>
                    <td
                      className={cn(
                        "whitespace-pre-wrap px-4 py-2",
                        !val.on_router && "text-red-600 font-bold"
                      )}
                    >
                      {!val.on_router ? (
                        <Tooltip title="Hilang di Mikrotik">
                          <span>{val.name}</span>
                        </Tooltip>
                      ) : (
                        val.name
                      )}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.comment}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val?.profile}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.active_records?.address}
                    </td>
                    {val.pelanggan ? (
                      <>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {val.pelanggan?.paket?.nama ?? ""}
                        </td>
                        <td className="whitespace-pre-wrap px-4 py-2">
                          {val.pelanggan?.paket
                            ? nominalPaketForDisplay(
                                val.pelanggan.paket,
                                ppnPct
                              ).toLocaleString("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                              })
                            : ""}
                        </td>
                      </>
                    ) : (
                      <td
                        className="whitespace-pre-wrap px-4 py-2 bg-yellow-100 dark:bg-amber-500/20 cursor-pointer"
                        colSpan={2}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          editDispatch({ action: "open", data: val });
                        }}
                      >
                        <div className="flex items-center justify-center gap-2 text-xs text-amber-900 dark:text-amber-100">
                          <TbUserPlus className="size-4 text-red-600 dark:text-red-400" />
                          <span>
                            Isi data pelanggan
                            {val.created
                              ? " · Diambil: " +
                                new Intl.DateTimeFormat("id-ID", {
                                  dateStyle: "long",
                                  timeStyle: "short",
                                }).format(new Date(val.created))
                              : ""}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.pelanggan?.penagihNama ? (
                        <span
                          className={cn(
                            !val.pelanggan.penagihAktif && "text-slate-400"
                          )}
                        >
                          {val.pelanggan.penagihNama}
                          {val.pelanggan.penagihAktif ? "" : " (nonaktif)"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={cn(
                        "whitespace-pre-wrap px-4 py-2 text-green-700",
                        val.pelanggan?.stop
                          ? "text-red-800"
                          : isPppSecretDisabled(val)
                          ? "text-amber-800"
                          : pppIsIsolir(val)
                          ? "text-red-600"
                          : !val.active_records
                          ? "text-black"
                          : ""
                      )}
                    >
                      {val.pelanggan?.stop ? (
                        <div className="flex flex-col">
                          <span className="font-bold">Berhenti</span>
                          {val.pelanggan.tgl_stop && (
                            <span className="text-[10px] font-normal text-slate-500">
                              {new Intl.DateTimeFormat("id-ID", {
                                dateStyle: "medium",
                              }).format(new Date(val.pelanggan.tgl_stop))}
                            </span>
                          )}
                        </div>
                      ) : isPppSecretDisabled(val) ? (
                        "Disabled"
                      ) : pppIsIsolir(val) ? (
                        "Isolir"
                      ) : !val.active_records ? (
                        "Nonaktif"
                      ) : (
                        "Aktif"
                      )}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <div className="flex gap-2 justify-center">
                        <Tooltip title="Lihat Data">
                          <Button
                            color="slatesky"
                            className="rounded py-0.5 relative"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              editDispatch({ action: "open", data: val });
                            }}
                          >
                            {val.pelanggan ? (
                              <TbEyeEdit className="size-4" />
                            ) : (
                              <TbUserPlus className="size-4 text-red-600" />
                            )}
                            {val.pelanggan?.nama ? (
                              <FaCheck
                                className="absolute -right-1 -top-1 h-3 w-3 text-green-500"
                                aria-hidden="true"
                              />
                            ) : null}
                          </Button>
                        </Tooltip>
                        {val.pelanggan ? (
                          <Tooltip title="PIN portal">
                            <Button
                              color="slatesky"
                              className="rounded py-0.5"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPinRow(val);
                              }}
                            >
                              <TbKey className="size-4" />
                            </Button>
                          </Tooltip>
                        ) : null}
                        {canChangePackage(val) ? (
                          <Tooltip title="Ganti profil dan paket">
                            <Button
                              color="slatesky"
                              className="rounded py-0.5"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPackageChange(val);
                              }}
                            >
                              <TbArrowsUpDown className="size-4" />
                            </Button>
                          </Tooltip>
                        ) : null}
                        {(!val.on_router || val.pelanggan?.stop) && role === "Superadmin" && (
                          <Tooltip title="Hapus">
                            <Button
                              color="slatesky"
                              className="rounded py-0.5 relative"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                hapusDispatch({ action: "open", data: val });
                              }}
                            >
                              <TbTrash className="size-4" />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-slate-50/80">
                <td colSpan={tableColSpan}>
                  <p className="px-4 py-2 text-center">
                    {displaySyncTime?.id
                      ? "Belum ada data"
                      : "Belum ada data sinkronisasi"}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      </div>

      {/* Mobile Card View */}
      <section className="flex flex-col gap-3 md:hidden w-full">
        {parsedData && parsedData.length > 0 ? (
          parsedData.map((val, idx) => {
            const numberPage = page <= 1 ? 0 : (page - 1) * limit;
            const nomor = idx + 1 + numberPage;
            return (
              <div
                key={idx}
                className={cn(
                  "w-full bg-white rounded-lg shadow-sm border p-3 flex flex-col gap-3",
                  isPelangganAutoFilled(val.pelanggan)
                    ? "border-amber-300 bg-amber-50/30"
                    : "border-slate-200"
                )}
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                  <div className="flex flex-col">
                    <div className="font-bold text-base flex items-center gap-2">
                      {petugasMode && val.pelanggan ? (
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${val.pelanggan.nama}`}
                          checked={selectedPelangganIds.includes(val.pelanggan.id)}
                          onChange={(e) => {
                            const id = val.pelanggan!.id;
                            setSelectedPelangganIds((prev) =>
                              e.target.checked
                                ? prev.includes(id)
                                  ? prev
                                  : [...prev, id]
                                : prev.filter((item) => item !== id)
                            );
                          }}
                        />
                      ) : null}
                      <span className="text-slate-500 text-sm">{nomor}.</span>
                      <span
                        className={!val.on_router ? "text-red-600 font-bold" : ""}
                      >
                        {val.name}
                      </span>
                      {!val.on_router && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-normal">
                          Hilang
                        </span>
                      )}
                    </div>
                    {val.comment && (
                      <span className="text-xs text-slate-500 mt-0.5 italic">
                        &quot;{val.comment}&quot;
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-base font-bold uppercase tracking-wider",
                      val.pelanggan?.stop
                        ? "text-red-800"
                        : isPppSecretDisabled(val)
                        ? "text-amber-800"
                        : pppIsIsolir(val)
                        ? "text-red-600"
                        : !val.active_records
                        ? "text-black"
                        : "text-green-700"
                    )}
                  >
                    {val.pelanggan?.stop ? (
                      <div className="flex flex-col items-end">
                        <span>Berhenti</span>
                        {val.pelanggan.tgl_stop && (
                          <span className="text-[10px] font-normal text-slate-500 normal-case tracking-normal">
                            {new Intl.DateTimeFormat("id-ID", {
                              dateStyle: "medium",
                            }).format(new Date(val.pelanggan.tgl_stop))}
                          </span>
                        )}
                      </div>
                    ) : isPppSecretDisabled(val) ? (
                      "Disabled"
                    ) : pppIsIsolir(val) ? (
                      "Isolir"
                    ) : !val.active_records ? (
                      "Nonaktif"
                    ) : (
                      "Aktif"
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                  <div className="col-span-2">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Pelanggan
                    </span>
                    {val.pelanggan?.nama &&
                    val.pelanggan.pembayaran.length === 0 ? (
                      <span className="font-bold text-green-600 flex flex-wrap items-center gap-1.5">
                        {val.pelanggan.nama} (Belum Tagihan)
                        <BoosterMark booster={val.booster} />
                      </span>
                    ) : (
                      <span className="font-medium text-slate-800 flex flex-wrap items-center gap-1.5">
                        {val.pelanggan?.nama || "-"}
                        <AutoFilledBadge at={val.pelanggan?.autoFilledAt} />
                        <PackageChangeMark mark={val.packageChange} />
                        <BoosterMark booster={val.booster} />
                      </span>
                    )}
                    <TglBerlanggananUnderNama pelanggan={val.pelanggan} />
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Profil
                    </span>
                    <span className="text-slate-700">{val.profile}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      IP Address
                    </span>
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      {val.active_records?.address || "-"}
                    </span>
                  </div>

                  {val.pelanggan ? (
                    <>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                          Paket
                        </span>
                        <span className="text-slate-700">
                          {val.pelanggan.paket?.nama ?? ""}
                        </span>
                      </div>
                      <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                      Harga
                    </span>
                    <span className="text-slate-700">
                      {nominalPaketForDisplay(
                        val.pelanggan.paket ?? { harga: 0, nominalPembayaran: null },
                        ppnPct
                      ).toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-0.5">
                          Petugas
                        </span>
                        <span
                          className={cn(
                            "text-slate-700",
                            val.pelanggan.penagihNama &&
                              !val.pelanggan.penagihAktif &&
                              "text-slate-400"
                          )}
                        >
                          {val.pelanggan.penagihNama
                            ? `${val.pelanggan.penagihNama}${
                                val.pelanggan.penagihAktif ? "" : " (nonaktif)"
                              }`
                            : "—"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div
                      className="col-span-2 bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100 text-xs p-2 rounded border border-amber-100 dark:border-amber-500/30 flex items-center gap-2 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        editDispatch({ action: "open", data: val });
                      }}
                    >
                      <span className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                      <TbUserPlus className="size-4 text-red-600 dark:text-red-400" />
                      <span>
                        Isi data pelanggan
                        {val.created
                          ? " · Diambil: " +
                            new Intl.DateTimeFormat("id-ID", {
                              dateStyle: "long",
                              timeStyle: "short",
                            }).format(new Date(val.created))
                          : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-slate-100 mt-1">
                  <Button
                    color="slatesky"
                    className="rounded-lg py-1.5 px-3 flex-1 justify-center text-xs relative"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      editDispatch({ action: "open", data: val });
                    }}
                  >
                    {val.pelanggan ? (
                      <TbEyeEdit className="size-4 mr-1.5" />
                    ) : (
                      <TbUserPlus className="size-4 mr-1.5" />
                    )}
                    Edit
                    {val.pelanggan?.nama ? (
                      <FaCheck
                        className="absolute top-1 right-1 h-2 w-2 text-green-500"
                        aria-hidden="true"
                      />
                    ) : null}
                  </Button>
                  {val.pelanggan ? (
                    <Button
                      color="slatesky"
                      className="rounded-lg py-1.5 px-3 justify-center text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPinRow(val);
                      }}
                    >
                      <TbKey className="size-4 mr-1.5" />
                      PIN
                    </Button>
                  ) : null}
                  {canChangePackage(val) ? (
                    <Button
                      color="slatesky"
                      className="rounded-lg py-1.5 px-3 justify-center text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPackageChange(val);
                      }}
                    >
                      <TbArrowsUpDown className="size-4 mr-1.5" />
                      Paket
                    </Button>
                  ) : null}
                  {(!val.on_router || val.pelanggan?.stop) && role === "Superadmin" && (
                    <Button
                      color="slatesky"
                      className="rounded-lg py-1.5 px-3 w-10 justify-center"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        hapusDispatch({ action: "open", data: val });
                      }}
                    >
                      <TbTrash className="size-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500 border border-slate-200 border-dashed">
            <p className="text-sm">
              {displaySyncTime?.id
                ? "Tidak ada data yang ditemukan"
                : "Belum ada data sinkronisasi"}
            </p>
          </div>
        )}
      </section>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Tampilkan</span>
          <select
            className="bg-slate-200/80 border-none rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
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
      <DialogEdit
        edit={edit}
        editDispatch={editDispatch}
        router={router}
        role={role}
        pakets={paket ?? []}
        ppn={ppn}
        mitraUserId={router?.userId ?? null}
        createOpen={addPelanggan}
        onCloseCreate={() => setAddPelanggan(false)}
        profiles={profiles.length > 0 ? profiles : uniqueProfiles}
      />
      <DialogPackageChange
        row={packageChange}
        routerId={router?.id ?? 0}
        pakets={paket ?? []}
        profiles={profiles.length > 0 ? profiles : uniqueProfiles}
        isolirProfileName={router?.isolirProfileName}
        ppn={ppnPct}
        packageChangeQuota={quotaLive}
        allowBooster={role === "Superadmin"}
        onClose={() => setPackageChange(null)}
        onSaved={applyPackageChange}
      />
      <DialogPortalPin
        row={pinRow}
        onClose={() => setPinRow(null)}
        onSaved={(secretId, pinSendiri) => {
          setTableData((rows) =>
            rows?.map((item) =>
              item.id === secretId && item.pelanggan
                ? { ...item, pelanggan: { ...item.pelanggan, pinSendiri } }
                : item
            )
          );
        }}
      />
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
              className="flex flex-col gap-1 w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 py-4 text-left text-gray-900 align-middle shadow-xl duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
            >
              <DialogTitle as="h3" className="text-base/7 font-medium">
                Hapus User PPP
              </DialogTitle>
              <p className="text-sm/6">
                Apakah Anda yakin ingin menghapus user PPP <b>{hapus.data?.name}</b>?
                <br />
                Hanya data PPP di aplikasi yang dihapus; secret dan sesi di
                Mikrotik tidak diubah. Riwayat pembayaran tetap tersimpan.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  color="slatesky"
                  onClick={() => hapusDispatch({ action: "close" })}
                >
                  Batal
                </Button>
                <Button color="red" onClick={handleDelete} disabled={mutating}>
                  {mutating ? "Menghapus..." : "Hapus"}
                </Button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={bulkHapusScope !== null}
        as="div"
        className="relative z-[1001]"
        onClose={() => !mutating && setBulkHapusScope(null)}
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black bg-opacity-25 duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <DialogPanel
              transition
              className="flex flex-col gap-2 w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 py-4 text-left text-gray-900 align-middle shadow-xl duration-300 ease-out data-[closed]:transform-[scale(95%)] data-[closed]:opacity-0"
            >
              <DialogTitle as="h3" className="text-base/7 font-medium">
                {bulkHapusScope === "nonaktif"
                  ? "Hapus massal PPP Nonaktif"
                  : bulkHapusScope === "berhenti"
                    ? "Hapus massal PPP Berhenti"
                    : "Hapus massal PPP Hilang di Mikrotik"}
              </DialogTitle>
              <p className="text-sm/6">
                Akan menghapus{" "}
                <span className="font-medium">
                  {bulkHapusScope === "nonaktif"
                    ? bulkNonaktifCount
                    : bulkHapusScope === "berhenti"
                      ? bulkBerhentiCount
                      : bulkOffRouterCount}
                </span>{" "}
                user PPP{" "}
                {bulkHapusScope === "off-router" ? (
                  <>
                    yang sudah <span className="font-medium">hilang di Mikrotik</span>
                    (nama merah)
                  </>
                ) : (
                  <>
                    untuk kategori tab{" "}
                    {bulkHapusScope === "nonaktif" ? (
                      <>
                        <span className="font-medium">Nonaktif</span> (belum
                        online, bukan isolir)
                      </>
                    ) : (
                      <>
                        <span className="font-medium">Berhenti</span>
                      </>
                    )}
                  </>
                )}
                {": "}
                Hanya baris PPP di aplikasi yang dihapus (secret dan sesi di
                Mikrotik tidak diubah). Data pelanggan dan riwayat pembayaran
                tidak dihapus; tautan PPP ke pelanggan dilepas (status
                berhenti).
                {bulkHapusScope !== "off-router" ? " Tab lain tidak ikut." : null}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  color="slatesky"
                  onClick={() => setBulkHapusScope(null)}
                  disabled={mutating}
                >
                  Batal
                </Button>
                <Button
                  color="red"
                  onClick={handleBulkDeletePpp}
                  disabled={mutating}
                >
                  {mutating ? "Menghapus..." : "Hapus semua"}
                </Button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
      <DialogAdd
        isOpen={addDialog}
        close={() => setAddDialog(false)}
        router={router}
        profiles={profiles.length > 0 ? profiles : uniqueProfiles}
      />
      <DialogBulkFillPelanggan
        isOpen={showBulkFillDialog}
        close={() => setShowBulkFillDialog(false)}
        onConfirm={bulkFillHandler}
        mutating={mutating}
        count={filterPPPData.belum}
        pakets={paket ?? []}
      />
      <DialogBulkTglIsolir
        isOpen={showBulkTglIsolir}
        close={() => !mutating && setShowBulkTglIsolir(false)}
        onConfirm={bulkTglIsolirHandler}
        mutating={mutating}
        count={registeredPelangganCount}
      />
      <DialogBulkTglBerlangganan
        isOpen={showBulkTglBerlangganan}
        close={() => !mutating && setShowBulkTglBerlangganan(false)}
        onConfirm={bulkTglBerlanggananHandler}
        mutating={mutating}
        months={subscriptionMonths}
      />
      <DialogBulkPetugas
        isOpen={showBulkPetugas}
        close={() => !mutating && setShowBulkPetugas(false)}
        onConfirm={bulkPetugasHandler}
        mutating={mutating}
        count={selectedPelangganIds.length}
        options={penagihOptions}
        loading={loadingPenagihOptions}
        mode={petugasMode ?? "ubah"}
      />
    </>
  );
}
