"use client";

import { cn } from "@/lib/utils";
import { resolveNoLayanan } from "@/lib/pelanggan-no-layanan";
import { resolveNoInvoice } from "@/lib/pembayaran-no-invoice";
import { Tooltip } from "@mui/material";
import {
  Paket,
  Pelanggan,
  Pembayaran,
  PppSecret,
  Router,
} from "@prisma/client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import toast from "react-hot-toast";
import Pagination from "../pagination";
import Search from "../search";
import DialogPembayaran from "./dialog-pembayaran";
import Statistik from "./statistik";
import { LoadingDataTable } from "./loading-datatable";
import { User } from "lucia";
import { Button } from "../button";
import DialogHitunganPaket, {
  type HitunganPaketRow,
  type HitunganRegulatorySettings,
} from "./dialog-hitungan-paket";
import DialogBulkPembayaran from "./dialog-bulk-pembayaran";
import DialogBulkBatalBayar from "./dialog-bulk-batal-bayar";
import DialogBulkHapusTagihan from "./dialog-bulk-hapus-tagihan";
import DialogBersihkanDuplikatTagihan from "./dialog-bersihkan-duplikat-tagihan";
import DialogBersihkanTanpaPpp from "./dialog-bersihkan-tanpa-ppp";
import DialogHapusBelumBayarBulanIni from "./dialog-hapus-belum-bayar-bulan-ini";
import DialogHapusSemuaTagihan from "./dialog-hapus-semua-tagihan";
import DialogResetTagihanBulan from "./dialog-reset-tagihan-bulan";
import DialogResetTagihanMitra from "./dialog-reset-tagihan-mitra";
import { Check } from "lucide-react";
import { HiBanknotes } from "react-icons/hi2";
import {
  pembayaranBulkInvoicePdfHref,
  pembayaranBulkInvoicePdfHrefForMonth,
  pembayaranSingleInvoicePdfHref,
} from "@/lib/invoice-bulk-pdf-href";
import { TbChevronDown, TbChevronUp, TbPlus, TbPrinter, TbTrash, TbUserMinus, TbUserPlus } from "react-icons/tb";
import PppBelumInputList from "./ppp-belum-input-list";
import type { PppBelumInputRow } from "@/lib/pembayaran-ppp-counts";
import DialogBerhentiPelanggan, {
  type BerhentiPelangganTarget,
} from "./dialog-berhenti-pelanggan";
import DialogResumePelanggan from "./dialog-resume-pelanggan";
import DialogHapusUserPppoe, {
  type HapusUserPppoeTarget,
} from "./dialog-hapus-user-pppoe";
import type { BillingStartMode } from "@prisma/client";
import DialogGenerate from "../header/dialog-generate";
import {
  buatTagihanPelangganBulan,
  triggerGeneratePaymentsForMitra,
} from "@/lib/server-actions/payment";
import {
  canBulkMarkPembayaranPelanggan,
  canCancelPembayaranPelanggan,
  canStaffManageBerhenti,
  canStaffManageIsolir,
  canStaffPayViaBank,
} from "@/lib/staff-permissions";
import PppIsolirAction from "@/components/router/ppp/isolir-action";
import IsolirRiwayatPopup, {
  BerhentiRiwayatPopup,
} from "@/components/pembayaran/isolir-riwayat-popup";
import { isPppIsolir } from "@/lib/ppp-isolir";
import { formatIsolirOlehShort } from "@/lib/isolir-actor-label";
import { parseJatuhTempoParts } from "@/lib/pembayaran-tax";
import { nominalPaketForDisplay, type PaketNominalFields } from "@/lib/paket-persist";
import { billingPeriodFromJatuhTempo } from "@/lib/billing-due-date";
import { isPelangganEligibleForBillingPeriod } from "@/lib/billing-start";
import {
  formatPembayaranStatusCellLabel,
  pembayaranBayarSekaligusLabel,
  pembayaranTransferBankName,
} from "@/lib/pembayaran-types";
import {
  formatPembayaranProcessedAt,
  formatPembayaranProcessorLabel,
} from "@/lib/pembayaran-inputter";
import type { PembayaranInputterInfo } from "@/lib/pembayaran-inputter";
import type { StaffAssignmentOption } from "@/lib/staff-pelanggan-scope";
import type { MetodeBayarFilter } from "@/lib/pembayaran-metode-filter";
import { petugasBulanBerjalan } from "@/lib/petugas-bulan";
import { RoleName } from "@prisma/client";

import {
  pelangganBayarFilterEmptyMessage,
  type PelangganBayarFilter,
} from "@/lib/pembayaran-pelanggan-bayar-filter";

export type StatusBayarBulanFilter = PelangganBayarFilter;

export type StatusIsolirFilter = "semua" | "isolir" | "aktif";

export type StatusPenagihFilter = "semua" | "tanpa" | `${number}`;

type PembayaranRow = Pembayaran & {
  inputter?: PembayaranInputterInfo | null;
  processedAt?: string | null;
  viaTripay?: boolean;
  bank?: { bank: string } | null;
};

function PembayaranStatusLabel({ pemb }: { pemb: PembayaranRow }) {
  const bankName = pembayaranTransferBankName(pemb);
  const sekaligus = pembayaranBayarSekaligusLabel(pemb.bayarSekaligus);
  return (
    <span className="flex flex-col items-center leading-tight text-center text-[10px] sm:text-xs">
      <span>{formatPembayaranStatusCellLabel(pemb)}</span>
      {bankName ? (
        <span className="text-[9px] font-semibold sm:text-[10px]">{bankName}</span>
      ) : null}
      {sekaligus ? (
        <span className="text-[9px] font-semibold sm:text-[10px]">{sekaligus}</span>
      ) : null}
    </span>
  );
}

type PelangganPembayaranRow = Pelanggan & {
  pembayaran: PembayaranRow[];
  isolirOleh?: string | null;
  isolirAt?: string | null;
  bukaIsolirOleh?: string | null;
  bukaIsolirAt?: string | null;
  berhentiOleh?: string | null;
  berhentiAt?: string | null;
  lanjutOleh?: string | null;
  lanjutAt?: string | null;
  ppp_secret: Pick<
    PppSecret,
    | "name"
    | "profile"
    | "disabled"
    | "isIsolir"
    | "profileBeforeIsolir"
    | "on_router"
  > | null;
  router: Pick<Router, "id" | "nama" | "isolirProfileName">;
  paket: Pick<Paket, "id" | "nama" | "harga"> & {
    nominalPembayaran?: number | null;
  };
  penagihPenugasan?: {
    penagih: { nama: string; aktif: boolean };
  } | null;
};

export type PembayaranLoadDataOpts = {
  refreshStats?: boolean;
  /** Refresh tanpa skeleton penuh — dipakai setelah aksi (bayar, isolir, dll.) */
  silent?: boolean;
};

export type PembayaranState = {
  modal: boolean;
  data?: Pelanggan & {
    pembayaran: Pembayaran;
  };
};

export type PembayaranAction =
  | { action: "open"; data: PembayaranState["data"] }
  | { action: "close" }
  | { action: "data"; data: PembayaranState["data"] };

/** Kuning selama masih di bulan jatuh tempo; merah setelah bulan berganti. */
function isBelumBayarMasihBulanTagihan(pemb: Pembayaran): boolean {
  const now = new Date();
  const nowPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const duePeriod = billingPeriodFromJatuhTempo(pemb.jatuh_tempo);
  return nowPeriod <= duePeriod;
}

function tagihanKosongLabel(
  val: PembayaranPelangganRow & { paket: { harga: number } },
  billingPeriod: string | undefined,
  billingStartMode: BillingStartMode | null,
  billingStartDate: Date | null,
  ownedByIsp = false
): string {
  if (val.stop) return "Berhenti";
  if (Math.round(Number(val.paket.harga)) <= 0) return "Gratis";
  if (
    val.ppp_secret != null &&
    isPppIsolir(val.ppp_secret, {
      isolirProfileName: val.router?.isolirProfileName,
    })
  ) {
    return "—";
  }
  if (
    billingPeriod &&
    val.tgl?.trim() &&
    !isPelangganEligibleForBillingPeriod({
      tgl: val.tgl,
      period: billingPeriod,
      billingStartMode,
      billingStartDate,
      ownedByIsp,
    })
  ) {
    return "Belum waktunya";
  }
  return "—";
}

/** Warna sel bulan (desktop table) */
function pembayaranStatusBg(pemb: Pembayaran | undefined): string {
  if (!pemb?.id) return "";
  if (pemb.status === "Terbayar") return "bg-green-500 dark:bg-green-600";
  if (pemb.status === "Belum" && isBelumBayarMasihBulanTagihan(pemb)) {
    return "bg-yellow-300 dark:bg-amber-400";
  }
  return "bg-red-500 dark:bg-red-600";
}

type PembayaranPelangganRow = Pelanggan & {
  isolirOleh?: string | null;
  isolirAt?: string | null;
  bukaIsolirOleh?: string | null;
  bukaIsolirAt?: string | null;
  berhentiOleh?: string | null;
  berhentiAt?: string | null;
  lanjutOleh?: string | null;
  lanjutAt?: string | null;
  ppp_secret: Pick<
    PppSecret,
    | "name"
    | "profile"
    | "disabled"
    | "isIsolir"
    | "profileBeforeIsolir"
    | "on_router"
  > | null;
  router: Pick<Router, "id" | "nama" | "isolirProfileName">;
};

function formatIsolirWaktu(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTglIsolir(tgl: number | null | undefined): string {
  if (tgl == null) return "—";
  return `Tgl ${tgl}`;
}

function petugasStatusIsolir(val: PembayaranPelangganRow): {
  text: string;
  tone: "isolir" | "berhenti" | "jadwal";
} | null {
  if (val.stop) return { text: "Berhenti", tone: "berhenti" };
  const tgl =
    val.tgl_isolir != null ? `Tgl isolir ${val.tgl_isolir}` : null;
  if (pelangganSedangIsolir(val)) {
    return {
      text: tgl ? `Isolir · ${tgl}` : "Isolir",
      tone: "isolir",
    };
  }
  if (tgl) return { text: tgl, tone: "jadwal" };
  return null;
}

function formatTglBerlangganan(tgl: string | null | undefined): string {
  if (!tgl?.trim()) return "—";
  const [y, m, d] = tgl.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return tgl;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function renderTglBerlanggananUnderPpp(tgl: string | null | undefined) {
  if (!tgl?.trim()) return null;
  return (
    <span className="block text-[11px] leading-snug text-slate-500 dark:text-theme-fg-muted mt-0.5">
      Tgl berlangganan: {formatTglBerlangganan(tgl)}
    </span>
  );
}

function renderPenagihNama(val: PelangganPembayaranRow) {
  const penagih = val.penagihPenugasan?.penagih;
  if (!penagih?.nama) return "—";
  return penagih.aktif ? penagih.nama : `${penagih.nama} (nonaktif)`;
}

function renderNoLayananUnderNama(val: PembayaranPelangganRow) {
  return (
    <span className="block text-[11px] leading-snug text-slate-500 dark:text-theme-fg-muted mt-0.5">
      No. Layanan: {resolveNoLayanan(val)}
    </span>
  );
}

function renderNoInvoiceUnderHarga(pemb: Pembayaran | undefined) {
  if (!pemb) return null;
  return (
    <span className="block text-[11px] leading-snug text-slate-500 dark:text-theme-fg-muted mt-0.5">
      INV {resolveNoInvoice(pemb)}
    </span>
  );
}

function pelangganSedangIsolir(val: PembayaranPelangganRow): boolean {
  if (val.stop || !val.ppp_secret) return false;
  return isPppIsolir(val.ppp_secret, {
    isolirProfileName: val.router.isolirProfileName,
  });
}

const isolirBadgeBox =
  "inline-flex h-6 w-[4.75rem] shrink-0 items-center justify-center rounded px-2 text-xs font-semibold leading-none";

function renderTglIsolirCell(val: PembayaranPelangganRow) {
  if (val.stop) {
    const oleh = formatIsolirOlehShort(val.berhentiOleh);
    const waktu = formatIsolirWaktu(val.berhentiAt);
    const keteranganBerhenti = oleh
      ? waktu
        ? `${oleh} • ${waktu}`
        : oleh
      : null;
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <span className={cn(isolirBadgeBox, "bg-slate-500 text-white")}>
          BERHENTI
        </span>
        {keteranganBerhenti ? (
          <BerhentiRiwayatPopup
            pelangganId={val.id}
            nama={val.nama}
            label={keteranganBerhenti}
          />
        ) : null}
      </div>
    );
  }

  const isolir = pelangganSedangIsolir(val);
  const label = formatTglIsolir(val.tgl_isolir);
  const statusTitle = [
    isolir ? "Isolir" : "Aktif",
    val.tgl_isolir != null ? `tanggal ${val.tgl_isolir}` : null,
    "klik untuk riwayat",
  ]
    .filter(Boolean)
    .join(" — ");
  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <Tooltip title={statusTitle}>
        <span>
          <IsolirRiwayatPopup pelangganId={val.id} nama={val.nama}>
            <span
              className={cn(
                isolirBadgeBox,
                "text-white",
                isolir
                  ? "bg-red-500 dark:bg-red-600"
                  : "bg-green-500 dark:bg-green-600"
              )}
            >
              {isolir ? "ISOLIR" : val.tgl_isolir == null ? "MANUAL" : label}
            </span>
          </IsolirRiwayatPopup>
        </span>
      </Tooltip>
      <BerhentiDanLanjutCatatan val={val} />
    </div>
  );
}

function catatanStatusPelanggan(
  executedBy: string | null | undefined,
  at: string | null | undefined,
  prefix: string
): string | null {
  const oleh = formatIsolirOlehShort(executedBy);
  if (!oleh) return null;
  const waktu = formatIsolirWaktu(at);
  return waktu ? `${prefix} ${oleh} • ${waktu}` : `${prefix} ${oleh}`;
}

function BerhentiDanLanjutCatatan({ val }: { val: PembayaranPelangganRow }) {
  const lanjut = catatanStatusPelanggan(val.lanjutOleh, val.lanjutAt, "Aktif");
  if (!lanjut) return null;
  return (
    <BerhentiRiwayatPopup
      pelangganId={val.id}
      nama={val.nama}
      label={lanjut}
    />
  );
}

/** Warna sel bulan (mobile card) */
function pembayaranStatusCellClass(pemb: Pembayaran | undefined): string {
  if (!pemb?.id) {
    return "bg-slate-100 dark:bg-theme-elevated text-slate-400 dark:text-theme-fg-muted border-slate-200 dark:border-theme-border";
  }
  if (pemb.status === "Terbayar") {
    return "bg-green-500 dark:bg-green-600 text-white border-green-600 dark:border-green-700";
  }
  if (pemb.status === "Belum" && isBelumBayarMasihBulanTagihan(pemb)) {
    return "bg-yellow-300 dark:bg-amber-400 text-yellow-900 dark:text-yellow-950 border-yellow-400 dark:border-amber-500";
  }
  return "bg-red-500 dark:bg-red-600 text-white border-red-600 dark:border-red-700";
}

function renderProcessorInfo(pemb: PembayaranRow | undefined) {
  if (!pemb || pemb.status !== "Terbayar") {
    return <span className="text-slate-400">—</span>;
  }
  const dateLabel = formatPembayaranProcessedAt(pemb.processedAt);
  return (
    <div className="flex flex-col gap-0.5 leading-snug">
      <span className="text-slate-700">
        {formatPembayaranProcessorLabel(pemb.inputter, pemb.viaTripay)}
      </span>
      {dateLabel ? (
        <span className="text-[10px] text-slate-500 tabular-nums">{dateLabel}</span>
      ) : null}
    </div>
  );
}

export default function Data({
  user,
  mode = "bayar",
  mitraUserId,
}: {
  user: User;
  /** `penagih` = halaman admin untuk melihat data petugas, terpisah dari pembayaran. */
  mode?: "bayar" | "penagih";
  mitraUserId?: number;
}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isPenagihView = mode === "penagih";
  const id = mitraUserId ?? parseInt(params.id as string);
  const staffAs = searchParams.get("staff");
  const isPetugasApp = user.role === RoleName.Petugas;
  const showPenagihColumn = !isPetugasApp;

  const showStaffFilter =
    user.role === RoleName.Superadmin || user.role === RoleName.Admin;

  const [staffOptions, setStaffOptions] = useState<StaffAssignmentOption[]>([]);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [bulan, setBulan] = useState<string>("");
  const petugasBolehBayarBulanIni =
    !isPetugasApp || bulan === petugasBulanBerjalan();
  const [filterBayarBulan, setFilterBayarBulan] =
    useState<StatusBayarBulanFilter>("tagihan");
  const [filterBank, setFilterBank] = useState<{
    nama: string;
    norek: string | null;
  } | null>(null);
  const [filterMetode, setFilterMetode] = useState<MetodeBayarFilter | null>(
    null
  );
  const [filterIsolir, setFilterIsolir] = useState<StatusIsolirFilter>("semua");
  const [filterPenagih, setFilterPenagih] = useState<StatusPenagihFilter>("semua");
  const [sortDiproses, setSortDiproses] = useState<"tanggal" | null>(null);
  const [sortBayar, setSortBayar] = useState<"belum" | null>(null);
  const [filterRouter, setFilterRouter] = useState("");
  const [tampilFilter, setTampilFilter] = useState(false);
  const [routerOptions, setRouterOptions] = useState<
    { id: number; nama: string }[]
  >([]);
  const [penagihOptions, setPenagihOptions] = useState<
    { id: number; nama: string; aktif: boolean }[]
  >([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkUnpaidIds, setBulkUnpaidIds] = useState<number[]>([]);
  const [bulkPaidIds, setBulkPaidIds] = useState<number[]>([]);
  const [bulkPdfLoading, setBulkPdfLoading] = useState(false);
  const [showPdfPageChoices, setShowPdfPageChoices] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showBulkRevertDialog, setShowBulkRevertDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showHapusSemuaBulanDialog, setShowHapusSemuaBulanDialog] =
    useState(false);
  const [showBersihkanTanpaPppDialog, setShowBersihkanTanpaPppDialog] =
    useState(false);
  const [showResetTagihanBulanDialog, setShowResetTagihanBulanDialog] =
    useState(false);
  const [showResetTagihanMitraDialog, setShowResetTagihanMitraDialog] =
    useState(false);
  const [showBersihkanDuplikatDialog, setShowBersihkanDuplikatDialog] =
    useState(false);
  const [showHapusBelumBayarBulanIniDialog, setShowHapusBelumBayarBulanIniDialog] =
    useState(false);
  const [refreshStatistik, setRefreshStatistik] = useState(0);

  useEffect(() => {
    if (!showStaffFilter) return;
    let active = true;
    (async () => {
      try {
        const resp = await fetch(
          `/api/user/staff-under-mitra?mitraId=${id}`,
          { cache: "no-store" }
        );
        const json = await resp.json();
        if (!resp.ok || !active) return;
        setStaffOptions(json.data ?? []);
      } catch {
        if (active) setStaffOptions([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, showStaffFilter]);

  const tutupFilter = useCallback(() => {
    setTampilFilter(false);
    setFilterRouter("");
    setFilterBayarBulan("tagihan");
    setFilterMetode(null);
    setFilterBank(null);
    setFilterIsolir("semua");
    setFilterPenagih("semua");
    setPage(1);
  }, []);

  const applyStaffFilter = useCallback(
    (staffId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!staffId) next.delete("staff");
      else next.set("staff", staffId);
      if (isPenagihView) {
        if (user.role === RoleName.Superadmin) next.set("mitraId", String(id));
        const qs = next.toString();
        router.replace(qs ? `/data-penagih?${qs}` : "/data-penagih");
        setPage(1);
        return;
      }
      const qs = next.toString();
      router.replace(qs ? `/pembayaran/${id}?${qs}` : `/pembayaran/${id}`);
      setPage(1);
    },
    [id, isPenagihView, router, searchParams, user.role]
  );

  useEffect(() => {
    if (!staffAs || staffOptions.length === 0) return;
    const selected = staffOptions.find((s) => String(s.id) === staffAs);
    if (selected?.unrestricted) applyStaffFilter("");
  }, [staffAs, staffOptions, applyStaffFilter]);

  const aturTampilFilter = useCallback(
    (buka: boolean) => {
      if (buka) {
        setTampilFilter(true);
        return;
      }
      tutupFilter();
      if (staffAs) applyStaffFilter("");
    },
    [applyStaffFilter, staffAs, tutupFilter]
  );

  const toggleUnpaidSelection = useCallback((id: number) => {
    setBulkUnpaidIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const togglePaidSelection = useCallback((id: number) => {
    setBulkPaidIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const tahun = useMemo(() => {
    if (!bulan) return null;
    const tahunParams = bulan.split("-").at(0);
    return tahunParams ? tahunParams : new Date().getFullYear().toString();
  }, [bulan]);

  const selectedMonthParts = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(bulan.trim())) return null;
    const [year, month] = bulan.split("-").map(Number);
    return { year, month, monthIndex: month - 1 };
  }, [bulan]);

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonthParts) return "Bulan";
    const label = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
      new Date(selectedMonthParts.year, selectedMonthParts.monthIndex, 1)
    );
    return `${label} ${selectedMonthParts.year}`;
  }, [selectedMonthParts]);

  const listEmptyMessage =
    filterBank
      ? `Tidak ada pembayaran transfer ${filterBank.nama} untuk ${selectedMonthLabel}.`
      : filterMetode === "Cash"
      ? `Tidak ada pembayaran tunai untuk ${selectedMonthLabel}.`
      : filterMetode === "Transfer"
        ? `Tidak ada pembayaran transfer untuk ${selectedMonthLabel}.`
        : pelangganBayarFilterEmptyMessage(filterBayarBulan, selectedMonthLabel);

  const canHapusSemuaBulan = useMemo(
    () => /^\d{4}-\d{2}$/.test(bulan.trim()),
    [bulan]
  );

  const pembayaranState = {
    modal: false,
    data: undefined,
  };
  const pembayaranActs = (state: PembayaranState, action: PembayaranAction) => {
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
  const [pembayaranDialog, pembayaranDialogDispatch] = useReducer(
    pembayaranActs,
    pembayaranState
  );

  // Server-side pagination: one page per request to keep payload and DB load bounded at 1000+ pelanggan.

  const [pelanggan, setPelanggan] = useState<PelangganPembayaranRow[]>([]);
  const [pppBelumInput, setPppBelumInput] = useState<PppBelumInputRow[]>([]);
  const [mitraPpn, setMitraPpn] = useState<number | null>(null);
  const [mitraPpnEnabled, setMitraPpnEnabled] = useState(true);
  const [mitraOwnedByIsp, setMitraOwnedByIsp] = useState(false);
  const [mitraBillingStartMode, setMitraBillingStartMode] =
    useState<BillingStartMode | null>("NEXT_MONTH");
  const [mitraBillingStartDate, setMitraBillingStartDate] =
    useState<Date | null>(null);
  const [mutating, setMutating] = useState(true);
  const refreshStatistikCounts = useCallback(() => {
    setRefreshStatistik((prev) => prev + 1);
  }, []);
  const loadData = useCallback(
    async (opts?: PembayaranLoadDataOpts) => {
      if (!tahun) return;
      const silent = opts?.silent === true;
      if (!silent) setMutating(true);
      try {
        const params = new URLSearchParams({
          tahun: String(tahun),
          page: String(page),
          limit: String(pageLimit),
          _t: String(Date.now()),
        });
        if (bulan) params.set("bulan", bulan);
        if (query) params.set("q", query);
        params.set("bayar", filterBayarBulan);
        if (filterMetode) params.set("metode", filterMetode);
        if (filterBank) {
          params.set("bank", filterBank.nama);
          if (filterBank.norek) params.set("norek", filterBank.norek);
        }
        if (filterIsolir !== "semua") params.set("isolir", filterIsolir);
        const penagihQuery = isPenagihView
          ? filterPenagih !== "semua" && filterPenagih !== "tanpa"
            ? filterPenagih
            : "ada"
          : filterPenagih !== "semua"
            ? filterPenagih
            : null;
        if (penagihQuery) params.set("penagih", penagihQuery);
        if (isPenagihView) params.set("rekap", "petugas");
        if (sortBayar) params.set("sort", sortBayar);
        else if (sortDiproses) params.set("sort", sortDiproses);
        if (filterRouter) params.set("router", filterRouter);
        if (staffAs) params.set("staff", staffAs);
        const resp = await fetch(
          `/api/pembayaran/pelanggan/${id}?${params.toString()}`,
          { cache: "no-store" }
        );
        const json = await resp.json();
        if (!resp.ok) throw new Error(json || "Terjadi kesalahan pada server");
        setPelanggan(json.data || []);
        setPppBelumInput(
          Array.isArray(json.pppBelumInput) ? json.pppBelumInput : []
        );
        setMitraPpn(json.mitraPpn ?? null);
        setMitraPpnEnabled(json.ppnEnabled !== false);
        setMitraBillingStartMode(json.mitraBillingStartMode ?? "NEXT_MONTH");
        setMitraOwnedByIsp(json.mitraOwnedByIsp === true);
        setMitraBillingStartDate(
          json.mitraBillingStartDate
            ? new Date(json.mitraBillingStartDate)
            : null
        );
        setRouterOptions(
          Array.isArray(json.routers)
            ? json.routers.filter(
                (row: { id?: number; nama?: string }) =>
                  typeof row?.id === "number" && typeof row?.nama === "string"
              )
            : []
        );
        setPenagihOptions(
          Array.isArray(json.penagih)
            ? json.penagih.filter(
                (row: { id?: number; nama?: string; aktif?: boolean }) =>
                  typeof row?.id === "number" && typeof row?.nama === "string"
              )
            : []
        );
        const lockId = json.penagihLock?.id;
        if (typeof lockId === "number") {
          const locked = String(lockId) as StatusPenagihFilter;
          setFilterPenagih((prev) => (prev === locked ? prev : locked));
        }
        const pagination = json.pagination;
        if (pagination?.totalPages != null)
          setTotalPages(Math.max(1, pagination.totalPages));
        if (opts?.refreshStats) refreshStatistikCounts();
      } catch (err) {
        const error = err as Error;
        console.error(error);
        toast.error("Terjadi kesalahan pada server");
      } finally {
        if (!silent) setMutating(false);
      }
    },
    [id, tahun, bulan, page, pageLimit, query, filterBayarBulan, filterMetode, filterBank, filterIsolir, filterPenagih, isPenagihView, sortDiproses, sortBayar, filterRouter, staffAs, refreshStatistikCounts]
  );

  const ppnTarifMitra = mitraPpnEnabled
    ? (mitraPpn ?? user.ppn ?? 11)
    : 0;

  const canManageIsolir = canStaffManageIsolir(user);

  const showInputterCol =
    user.role === RoleName.Superadmin ||
    user.role === RoleName.Admin ||
    user.role === RoleName.Keuangan ||
    user.role === RoleName.Teknisi;

  const canCancelPembayaran = canCancelPembayaranPelanggan(user);
  const canBulkPay = canBulkMarkPembayaranPelanggan(user);
  const canPayViaBank = canStaffPayViaBank(user);

  const canManageBerhenti = canStaffManageBerhenti(user);

  const [berhentiTarget, setBerhentiTarget] =
    useState<BerhentiPelangganTarget | null>(null);
  const [showBerhentiDialog, setShowBerhentiDialog] = useState(false);
  const [resumeTarget, setResumeTarget] =
    useState<BerhentiPelangganTarget | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [hapusPppTarget, setHapusPppTarget] =
    useState<HapusUserPppoeTarget | null>(null);
  const [showHapusPppDialog, setShowHapusPppDialog] = useState(false);
  const [creatingTagihanId, setCreatingTagihanId] = useState<number | null>(null);

  const openPembayaranDialog = useCallback(
    (
      val: (typeof pelanggan)[number],
      pemb: Pembayaran
    ) => {
      pembayaranDialogDispatch({
        action: "open",
        data: { ...val, pembayaran: pemb },
      });
    },
    []
  );

  const renderAksiButtons = (
    val: (typeof pelanggan)[number],
    pemb: Pembayaran | undefined
  ) => (
    <div className="flex justify-center items-center gap-1.5 flex-wrap">
      <Tooltip
        title={
          isBulkMode
            ? "Nonaktif saat mode pilih banyak"
            : pemb
              ? pemb.status === "Terbayar"
                ? canCancelPembayaran
                  ? "Lihat / batalkan pembayaran"
                  : "Lihat pembayaran (sudah lunas)"
                : "Bayar tagihan"
              : "Tidak ada tagihan bulan ini"
        }
      >
        <span>
          <Button
            type="button"
            color="slatesky"
            disabled={!pemb || mutating || isBulkMode}
            className={cn(
              "rounded py-0.5",
              pemb?.status === "Terbayar" && "ring-1 ring-green-400/80"
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (pemb) openPembayaranDialog(val, pemb);
            }}
          >
            <HiBanknotes
              className={cn(
                "size-4",
                !pemb
                  ? "text-slate-400"
                  : pemb.status === "Terbayar"
                    ? "text-green-600"
                    : "text-sky-600"
              )}
            />
          </Button>
        </span>
      </Tooltip>
      {pemb ? (
        <Tooltip
          title={
            isBulkMode
              ? "Nonaktif saat mode pilih banyak"
              : pemb.status === "Terbayar"
                ? "Invoice / kuitansi"
                : "Invoice tagihan"
          }
        >
          <span>
            <Button
              type="button"
              color="slatesky"
              disabled={mutating || isBulkMode}
              className="hidden rounded py-0.5 md:inline-flex"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(
                  pembayaranSingleInvoicePdfHref(pemb.id),
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
            >
              <TbPrinter className="size-4 text-violet-600" />
            </Button>
          </span>
        </Tooltip>
      ) : null}
      {canManageIsolir ? (
        <PppIsolirAction
          routerId={val.router.id}
          isolirProfileName={val.router.isolirProfileName}
          ppp={val.ppp_secret}
          hidden={val.stop || !val.ppp_secret}
          disabled={mutating}
          onSuccess={() => loadData({ silent: true })}
        />
      ) : null}
      {canManageBerhenti && !val.stop && val.ppp_secretId ? (
        <Tooltip
          title={
            isBulkMode
              ? "Nonaktif saat mode pilih banyak"
              : "Berhenti berlangganan (tagihan bulan ini tetap)"
          }
        >
          <span>
            <Button
              type="button"
              color="amber"
              disabled={mutating || isBulkMode}
              className="rounded py-0.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBerhentiTarget({
                  id: val.id,
                  nama: val.nama,
                  ppp_secretId: val.ppp_secretId,
                  ppp_secret: val.ppp_secret?.name
                    ? { name: val.ppp_secret.name }
                    : null,
                });
                setShowBerhentiDialog(true);
              }}
            >
              <TbUserMinus className="size-4 text-amber-700" />
            </Button>
          </span>
        </Tooltip>
      ) : null}
      {canManageBerhenti && val.stop && val.ppp_secretId ? (
        <Tooltip
          title={
            isBulkMode
              ? "Nonaktif saat mode pilih banyak"
              : "Mulai berlangganan kembali"
          }
        >
          <span>
            <Button
              type="button"
              color="sky"
              disabled={mutating || isBulkMode}
              className="rounded py-0.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setResumeTarget({
                  id: val.id,
                  nama: val.nama,
                  ppp_secretId: val.ppp_secretId,
                  ppp_secret: val.ppp_secret?.name
                    ? { name: val.ppp_secret.name }
                    : null,
                });
                setShowResumeDialog(true);
              }}
            >
              <TbUserPlus className="size-4 text-sky-700" />
            </Button>
          </span>
        </Tooltip>
      ) : null}
      {user.role === RoleName.Superadmin &&
      !isPenagihView &&
      !isPetugasApp &&
      filterBayarBulan === "tanpa_tagihan" &&
      !pemb ? (
        <Tooltip title={`Buat tagihan ${selectedMonthLabel}`}>
          <span>
            <Button
              type="button"
              color="sky"
              disabled={mutating || creatingTagihanId === val.id}
              className="rounded py-0.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const ok = window.confirm(
                  `Buat tagihan ${selectedMonthLabel} untuk ${val.nama}?`
                );
                if (!ok) return;
                setCreatingTagihanId(val.id);
                void buatTagihanPelangganBulan(val.id, id, bulan.trim())
                  .then(async (res) => {
                    if (!res.success) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(res.message);
                    await loadData({ refreshStats: true, silent: true });
                  })
                  .catch(() => {
                    toast.error("Gagal membuat tagihan");
                  })
                  .finally(() => setCreatingTagihanId(null));
              }}
            >
              <TbPlus className="size-4 text-white" />
            </Button>
          </span>
        </Tooltip>
      ) : null}
      {user.role === RoleName.Superadmin && val.ppp_secretId ? (
        <Tooltip
          title={
            isBulkMode
              ? "Nonaktif saat mode pilih banyak"
              : "Hapus tagihan belum bayar (data PPPoE tetap)"
          }
        >
          <span>
            <Button
              type="button"
              color="slatesky"
              disabled={mutating || isBulkMode}
              className="rounded py-0.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHapusPppTarget({
                  pelangganId: val.id,
                  nama: val.nama,
                  pppName: val.ppp_secret?.name || "-",
                });
                setShowHapusPppDialog(true);
              }}
            >
              <TbTrash className="size-4 text-red-600" />
            </Button>
          </span>
        </Tooltip>
      ) : null}
    </div>
  );

  const tagihanBulananDariPaket = useCallback(
    (paket: PaketNominalFields) =>
      nominalPaketForDisplay(paket, ppnTarifMitra),
    [ppnTarifMitra]
  );

  const findPembayaranBulanTerpilih = useCallback(
    (pembayaran: PembayaranRow[]) => {
      if (!selectedMonthParts) return undefined;
      const inMonth = pembayaran.filter((pemb) => {
        const { year, month } = parseJatuhTempoParts(pemb.jatuh_tempo);
        return (
          year === selectedMonthParts.year &&
          month === selectedMonthParts.month
        );
      });
      if (filterBayarBulan === "belum") {
        return inMonth.find((p) => p.status === "Belum");
      }
      if (filterBayarBulan === "terbayar") {
        return inMonth.find((p) => p.status === "Terbayar");
      }
      return inMonth[0];
    },
    [selectedMonthParts, filterBayarBulan]
  );

  const selectedInvoiceIds = useMemo(
    () => [...new Set([...bulkUnpaidIds, ...bulkPaidIds])],
    [bulkUnpaidIds, bulkPaidIds]
  );

  const selectAllInvoicesOnPage = useCallback(() => {
    const unpaid: number[] = [];
    const paid: number[] = [];
    for (const val of pelanggan) {
      const pemb = findPembayaranBulanTerpilih(val.pembayaran);
      if (!pemb) continue;
      if (pemb.status === "Terbayar") paid.push(pemb.id);
      else unpaid.push(pemb.id);
    }
    setBulkUnpaidIds(unpaid);
    setBulkPaidIds(paid);
  }, [pelanggan, findPembayaranBulanTerpilih]);

  const printBulkInvoices = useCallback(
    (payload: { ids?: number[]; allMonth?: boolean }) => {
      if (payload.allMonth && !/^\d{4}-\d{2}$/.test(bulan.trim())) {
        toast.error("Pilih bulan di statistik terlebih dahulu");
        return;
      }
      if (!payload.allMonth && (!payload.ids || payload.ids.length === 0)) {
        toast.error("Pilih minimal satu tagihan");
        return;
      }

      const href = payload.allMonth
        ? pembayaranBulkInvoicePdfHrefForMonth(id, bulan.trim())
        : pembayaranBulkInvoicePdfHref(payload.ids!);

      setBulkPdfLoading(true);
      const opened = window.open(href, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.error("Izinkan pop-up untuk membuka PDF invoice");
      }
      window.setTimeout(() => setBulkPdfLoading(false), 800);
    },
    [bulan, id]
  );

  const printInvoicePage = useCallback(
    async (targetPage: number) => {
      if (!tahun || !/^\d{4}-\d{2}$/.test(bulan.trim())) {
        toast.error("Pilih bulan di statistik terlebih dahulu");
        return;
      }
      setBulkPdfLoading(true);
      try {
        let rows = pelanggan;
        if (targetPage !== page) {
          const params = new URLSearchParams({
            tahun: String(tahun),
            page: String(targetPage),
            limit: String(pageLimit),
            bayar: filterBayarBulan,
          });
          if (bulan) params.set("bulan", bulan);
          if (query) params.set("q", query);
          if (filterMetode) params.set("metode", filterMetode);
          if (filterBank) {
            params.set("bank", filterBank.nama);
            if (filterBank.norek) params.set("norek", filterBank.norek);
          }
          if (filterIsolir !== "semua") params.set("isolir", filterIsolir);
          const penagihQuery = isPenagihView
          ? filterPenagih !== "semua" && filterPenagih !== "tanpa"
            ? filterPenagih
            : "ada"
          : filterPenagih !== "semua"
            ? filterPenagih
            : null;
        if (penagihQuery) params.set("penagih", penagihQuery);
          if (isPenagihView) params.set("rekap", "petugas");
          if (sortBayar) params.set("sort", sortBayar);
          else if (sortDiproses) params.set("sort", sortDiproses);
          if (filterRouter) params.set("router", filterRouter);
          if (staffAs) params.set("staff", staffAs);
          const resp = await fetch(
            `/api/pembayaran/pelanggan/${id}?${params.toString()}`,
            { cache: "no-store" }
          );
          const json = await resp.json();
          if (!resp.ok) {
            throw new Error("Gagal memuat tagihan halaman ini");
          }
          rows = Array.isArray(json.data) ? json.data : [];
        }
        const ids: number[] = [];
        for (const row of rows) {
          const pemb = findPembayaranBulanTerpilih(row.pembayaran);
          if (pemb) ids.push(pemb.id);
        }
        if (ids.length === 0) {
          toast.error(`Tidak ada tagihan di halaman ${targetPage}`);
          return;
        }
        printBulkInvoices({ ids });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menyiapkan PDF halaman ini"
        );
      } finally {
        setBulkPdfLoading(false);
      }
    },
    [
      tahun,
      bulan,
      page,
      pageLimit,
      pelanggan,
      query,
      filterBayarBulan,
      filterMetode,
      filterBank,
      filterIsolir,
      filterPenagih,
      isPenagihView,
      sortDiproses,
      sortBayar,
      filterRouter,
      staffAs,
      id,
      findPembayaranBulanTerpilih,
      printBulkInvoices,
    ]
  );

  useEffect(() => {
    setPage(1);
  }, [staffAs]);

  useEffect(() => {
    if (!tahun) return;
    loadData();
  }, [loadData, tahun]);

  // Reset to first page when billing month changes (Statistik); search already resets page in handleSearch.
  useEffect(() => {
    setPage(1);
  }, [bulan, filterBayarBulan, filterMetode, filterBank, filterIsolir, filterPenagih, sortDiproses, sortBayar, filterRouter]);

  const handleSearch = useCallback((val: string) => {
    setPage(1);
    setQuery(val);
  }, []);

  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [mutatingGenerate, setMutatingGenerate] = useState(false);

  const selectedMonthLabelForGenerate = useMemo(() => {
    if (!selectedMonthParts) return "";
    return new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date(selectedMonthParts.year, selectedMonthParts.monthIndex, 1));
  }, [selectedMonthParts]);

  const handleGenerate = async () => {
    if (!/^\d{4}-\d{2}$/.test(bulan.trim())) {
      toast.error("Pilih bulan di statistik terlebih dahulu (mis. Juni 2026)");
      return;
    }
    setMutatingGenerate(true);
    try {
      const res = await triggerGeneratePaymentsForMitra(id, bulan.trim());
      if (!res.success) throw new Error(res.error);
      toast.success(res.message);
      
      // Close dialog immediately
      setShowGenerateDialog(false);
      
      await loadData({ refreshStats: true, silent: true });

    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setMutatingGenerate(false);
    }
  };

  const [showPaketDialog, setShowPaketDialog] = useState(false);
  const [hitunganPaketData, setHitunganPaketData] = useState<HitunganPaketRow[]>(
    []
  );
  const [hitunganPaketPpn, setHitunganPaketPpn] = useState<number | null>(null);
  const [hitunganPaketPpnEnabled, setHitunganPaketPpnEnabled] = useState(true);
  const [hitunganPaketRegulatory, setHitunganPaketRegulatory] =
    useState<HitunganRegulatorySettings | null>(null);
  const [loadingHitunganPaket, setLoadingHitunganPaket] = useState(false);

  useEffect(() => {
    if (!showPaketDialog || !bulan) return;
    const ac = new AbortController();
    setLoadingHitunganPaket(true);
    (async () => {
      try {
        const rekapParams = new URLSearchParams({ bulan });
        if (staffAs) rekapParams.set("staff", staffAs);
        const resp = await fetch(
          `/api/pembayaran/rekap-paket/${id}?${rekapParams.toString()}`,
          { cache: "no-store", signal: ac.signal }
        );
        const json = (await resp.json()) as {
          data?: HitunganPaketRow[];
          ppn?: number | null;
          ppnEnabled?: boolean;
          regulatory?: HitunganRegulatorySettings;
          error?: string;
        };
        if (!resp.ok) {
          throw new Error(json.error ?? "Gagal memuat rekap per paket");
        }
        setHitunganPaketData(json.data ?? []);
        setHitunganPaketPpn(json.ppn ?? null);
        setHitunganPaketPpnEnabled(json.ppnEnabled !== false);
        setHitunganPaketRegulatory(json.regulatory ?? null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error(err);
        toast.error((err as Error).message);
        setHitunganPaketData([]);
      } finally {
        if (!ac.signal.aborted) setLoadingHitunganPaket(false);
      }
    })();
    return () => ac.abort();
  }, [showPaketDialog, bulan, id, staffAs]);

  useEffect(() => {
    if (!showPaketDialog) {
      setHitunganPaketData([]);
      setHitunganPaketPpn(null);
      setHitunganPaketRegulatory(null);
    }
  }, [showPaketDialog]);

  // List is server-paginated and optionally server-filtered by q; no client-side slice.
  const listPelanggan = pelanggan;
  const isBelumInputView = filterBayarBulan === "belum_input";

  const staffTerbatas = useMemo(
    () => staffOptions.filter((s) => !s.unrestricted),
    [staffOptions]
  );

  const activeStaffLabel = useMemo(() => {
    if (!staffAs) return null;
    const s = staffTerbatas.find((o) => String(o.id) === staffAs);
    return s ? `${s.nama} (${s.role})` : null;
  }, [staffAs, staffTerbatas]);

  const listPaginationBar = (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0",
        isPetugasApp ? "justify-center" : "justify-start"
      )}
    >
      {isPetugasApp ? null : (
      <div className="hidden items-center gap-2 text-sm text-slate-600 dark:text-theme-fg-muted shrink-0 md:flex">
        <span>Tampilkan</span>
        <select
          className="rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card py-1.5 px-3 text-sm text-slate-800 dark:text-theme-fg focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
          value={pageLimit}
          onChange={(e) => {
            setPageLimit(Number(e.target.value));
            setPage(1);
          }}
          disabled={mutating}
          aria-label="Jumlah baris per halaman"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span>data</span>
      </div>
      )}
      <div className="w-full min-w-0 max-w-full md:w-auto md:shrink-0">
        <Pagination
          isSearchParams={false}
          pageState={page}
          totalPagesState={totalPages}
          onChange={(val) => setPage(val)}
        />
      </div>
    </div>
  );

  function renderDiprosesOlehSort(fill: "cell" | "chip") {
    const active = sortDiproses === "tanggal";
    const Arrow = active ? TbChevronUp : TbChevronDown;
    return (
      <button
        type="button"
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-1 appearance-none border-0 font-inherit focus:outline-none",
          fill === "cell" ? "h-full w-full px-4 py-2" : "rounded px-2 py-1",
          active
            ? "bg-sky-600 text-white dark:bg-sky-700"
            : "bg-transparent text-inherit hover:text-sky-700 dark:hover:text-sky-300"
        )}
        disabled={mutating}
        title={
          active
            ? "Urutan tanggal terbaru aktif. Klik lagi untuk urutan semula"
            : "Urutkan tanggal terbaru di atas"
        }
        aria-pressed={active}
        onClick={() => {
          setSortDiproses((current) => (current === "tanggal" ? null : "tanggal"));
          setSortBayar(null);
          setPage(1);
        }}
      >
        Diproses oleh
        <Arrow className="size-3.5 shrink-0" aria-hidden />
      </button>
    );
  }

  function renderUrutanBelum(fill: "cell" | "chip") {
    const active = sortBayar === "belum";
    const Arrow = active ? TbChevronUp : TbChevronDown;
    return (
      <button
        type="button"
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-1 appearance-none border-0 font-inherit focus:outline-none",
          fill === "cell" ? "h-full w-full px-4 py-2" : "rounded px-2 py-1",
          active
            ? "bg-sky-600 text-white dark:bg-sky-700"
            : "bg-transparent text-inherit hover:text-sky-700 dark:hover:text-sky-300"
        )}
        disabled={mutating}
        title={
          active
            ? "Yang belum bayar di atas. Klik lagi untuk urutan semula"
            : "Urutkan yang belum bayar di atas"
        }
        aria-pressed={active}
        onClick={() => {
          setSortBayar((current) => (current === "belum" ? null : "belum"));
          setSortDiproses(null);
          setPage(1);
        }}
      >
        {selectedMonthLabel}
        <Arrow className="size-3.5 shrink-0" aria-hidden />
      </button>
    );
  }

  return (
    <>
      <Statistik
        bulan={bulan}
        setBulan={setBulan}
        tahun={tahun}
        userId={id}
        staffAs={staffAs}
        filterBayar={filterBayarBulan}
        filterIsolir={filterIsolir}
        filterPenagih={
          isPenagihView && (filterPenagih === "semua" || filterPenagih === "tanpa")
            ? "ada"
            : filterPenagih
        }
        filterRouter={filterRouter ? Number(filterRouter) : null}
        collectorView={user.role === RoleName.Petugas}
        hidePppCounts={isPenagihView}
        filterMetode={filterMetode}
        filterBank={filterBank}
        onFilterMetodeChange={(metode) => {
          const keepAllTransfers = metode === "Transfer" && filterBank != null;
          setFilterBank(null);
          setFilterMetode((current) =>
            keepAllTransfers ? "Transfer" : current === metode ? null : metode
          );
          setFilterBayarBulan("semua");
          setFilterIsolir("semua");
          setPage(1);
        }}
        onFilterBankChange={(bank) => {
          setFilterBank((current) => {
            const same =
              current?.nama === bank.nama &&
              (current?.norek ?? "") === (bank.norek ?? "");
            const next = same ? null : bank;
            setFilterMetode(next ? "Transfer" : null);
            return next;
          });
          setFilterBayarBulan("semua");
          setFilterIsolir("semua");
          setPage(1);
        }}
        refreshTrigger={refreshStatistik}
        onFilterBayarChange={(filter) => {
          setFilterBayarBulan((current) => (current === filter ? "tagihan" : filter));
          setPage(1);
        }}
      />
      <section className="flex flex-col gap-3 pb-0 w-full self-stretch">
        <div
          className={cn(
            "grid gap-x-4 gap-y-3 items-start",
            isPetugasApp
              ? "grid-cols-1"
              : "grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
          )}
        >
          <div className="order-2 md:order-none md:col-start-1 md:row-start-1 min-w-0 w-full">
            <div
              className={cn(
                "flex flex-row flex-wrap items-center gap-2 max-md:flex-col max-md:items-stretch",
                isPetugasApp && "flex-col items-stretch"
              )}
            >
              <div
                className={cn(
                  "flex-1 min-w-[8rem] max-w-full max-md:w-full",
                  !isPetugasApp && "md:max-w-xs"
                )}
              >
                <div className="w-full [&>div]:!max-w-none [&>div]:w-full">
                  <Search
                    isSearchParams={false}
                    queryState={query}
                    handleSearch={handleSearch}
                    appearance={isPetugasApp ? "app" : "adaptive"}
                    placeholder={isPetugasApp ? "Cari nama atau alamat" : undefined}
                  />
                </div>
              </div>
              {!isPetugasApp ? (
                <span className="inline-flex shrink-0 items-center gap-2 text-sm text-slate-700 dark:text-theme-fg max-md:w-full max-md:justify-between max-md:rounded-2xl max-md:border max-md:border-slate-200 max-md:bg-white max-md:px-4 max-md:py-3 max-md:shadow-sm dark:max-md:border-theme-border dark:max-md:bg-theme-card md:ml-4">
                  <span>Filter</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={tampilFilter}
                    aria-label="Tampilkan filter"
                    title="Tampilkan filter"
                    disabled={mutating}
                    onClick={() => aturTampilFilter(!tampilFilter)}
                    className={cn(
                      "relative h-7 w-12 shrink-0 rounded-full transition-colors md:h-5 md:w-10",
                      tampilFilter ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-600"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform md:top-0.5 md:left-0.5 md:size-4",
                        tampilFilter && "translate-x-5 md:translate-x-5"
                      )}
                    />
                  </button>
                </span>
              ) : null}
              {isPetugasApp ? (
              <label
                className={cn(
                  "flex items-center gap-2 text-sm text-slate-700 dark:text-theme-fg",
                  isPetugasApp ? "w-full" : "shrink-0"
                )}
              >
                <span
                  className={cn(
                    "shrink-0",
                    !isPetugasApp && "hidden min-[400px]:inline"
                  )}
                >
                  {isPetugasApp ? "Status" : "Bayar:"}
                </span>
                <select
                  className={cn(
                    "rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card py-2 px-3 text-sm text-slate-800 dark:text-theme-fg max-w-full",
                    isPetugasApp
                      ? "h-12 w-full border-sky-200 bg-sky-50 text-base text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
                      : "w-[9.5rem]"
                  )}
                  value={
                    isPetugasApp && filterIsolir === "isolir"
                      ? "isolir"
                      : filterBayarBulan === "belum" ||
                          filterBayarBulan === "terbayar"
                        ? filterBayarBulan
                        : "semua"
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    setFilterMetode(null);
                    setFilterBank(null);
                    if (isPetugasApp && next === "isolir") {
                      setFilterIsolir("isolir");
                      setFilterBayarBulan("semua");
                    } else {
                      if (isPetugasApp) setFilterIsolir("semua");
                      setFilterBayarBulan(
                        next === "belum" || next === "terbayar" ? next : "semua"
                      );
                    }
                    setPage(1);
                  }}
                  disabled={mutating}
                  aria-label={
                    isPetugasApp
                      ? "Filter status tagihan atau isolir"
                      : "Filter status pembayaran pada bulan yang dipilih"
                  }
                >
                  <option value="semua">Semua</option>
                  <option value="terbayar">Sudah bayar</option>
                  <option value="belum">Belum bayar</option>
                  {isPetugasApp ? <option value="isolir">Isolir</option> : null}
                </select>
              </label>
              ) : null}
            </div>
          </div>
          <div className={cn("order-1 md:order-none md:col-start-2 md:row-start-1 flex-col justify-center items-center gap-0.5 px-2", isPetugasApp ? "hidden" : "hidden md:flex")}>
            <p className="font-medium whitespace-nowrap">
              {isPenagihView ? "Data Penagih" : "Pembayaran"}
            </p>
            {activeStaffLabel ? (
              <p className="text-xs text-sky-800 dark:text-sky-400 font-normal text-center whitespace-nowrap">
                PPPoE staff: {activeStaffLabel}
              </p>
            ) : null}
          </div>
          {isPenagihView && !isBelumInputView && /^\d{4}-\d{2}$/.test(bulan.trim()) ? (
            <div className="order-4 hidden min-w-0 flex-col items-center gap-1 md:order-none md:col-start-3 md:row-start-1 md:flex md:items-end md:justify-self-end">
              <Button
                disabled={mutating || (bulkPdfLoading && !showPdfPageChoices)}
                onClick={() => {
                  if (showPdfPageChoices) {
                    setShowPdfPageChoices(false);
                    return;
                  }
                  if (totalPages <= 1) {
                    void printInvoicePage(1);
                    return;
                  }
                  setShowPdfPageChoices(true);
                }}
                color="slatesky"
                className="shrink-0 whitespace-nowrap"
              >
                {showPdfPageChoices && totalPages > 1 ? null : (
                  <TbPrinter className="inline size-4 mr-1 text-violet-600" />
                )}
                {showPdfPageChoices && totalPages > 1 ? "Batal" : "Cetak INV"}
              </Button>
              {showPdfPageChoices && totalPages > 1 ? (
                <div className="flex max-h-28 max-w-md flex-wrap justify-end gap-1 overflow-y-auto">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                    (pageNumber) => (
                      <Button
                        key={pageNumber}
                        disabled={mutating || bulkPdfLoading}
                        onClick={() => void printInvoicePage(pageNumber)}
                        color={pageNumber === page ? "sky" : "slatesky"}
                        className="shrink-0 whitespace-nowrap px-2 py-1 text-xs"
                      >
                        Halaman {pageNumber}
                      </Button>
                    )
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={cn("order-4 md:order-none md:col-start-3 md:row-start-1 min-w-0 flex flex-wrap items-center gap-2 justify-start overflow-visible md:justify-end md:justify-self-end", (isPetugasApp || isPenagihView) && "hidden")}>
            {canBulkPay && isBulkMode && (
              <Button
                disabled={mutating || bulkPdfLoading}
                onClick={selectAllInvoicesOnPage}
                color="slatesky"
                className="shrink-0 whitespace-nowrap"
              >
                Pilih semua tagihan
              </Button>
            )}
            {canBulkPay && isBulkMode && selectedInvoiceIds.length > 0 && (
              <Button
                disabled={mutating || bulkPdfLoading}
                onClick={() => printBulkInvoices({ ids: selectedInvoiceIds })}
                color="slatesky"
                className="hidden shrink-0 whitespace-nowrap md:inline-flex"
              >
                <TbPrinter className="inline size-4 mr-1 text-violet-600" />
                Cetak INV ({selectedInvoiceIds.length})
              </Button>
            )}
            {!isBelumInputView && /^\d{4}-\d{2}$/.test(bulan.trim()) && (
              <div className="hidden shrink-0 max-w-full flex-col items-end gap-1 md:flex">
                <Button
                  disabled={mutating || (bulkPdfLoading && !showPdfPageChoices)}
                  onClick={() => {
                    if (showPdfPageChoices) {
                      setShowPdfPageChoices(false);
                      return;
                    }
                    if (totalPages <= 1) {
                      void printInvoicePage(1);
                      return;
                    }
                    setShowPdfPageChoices(true);
                  }}
                  color="slatesky"
                  className="shrink-0 whitespace-nowrap"
                >
                  {showPdfPageChoices && totalPages > 1 ? null : (
                    <TbPrinter className="inline size-4 mr-1 text-violet-600" />
                  )}
                  {showPdfPageChoices && totalPages > 1 ? "Batal" : "Cetak INV"}
                </Button>
                {showPdfPageChoices && totalPages > 1 ? (
                  <div className="flex flex-wrap justify-end gap-1 max-w-md max-h-28 overflow-y-auto">
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                      (pageNumber) => (
                        <Button
                          key={pageNumber}
                          disabled={mutating || bulkPdfLoading}
                          onClick={() => void printInvoicePage(pageNumber)}
                          color={pageNumber === page ? "sky" : "slatesky"}
                          className="shrink-0 whitespace-nowrap text-xs py-1 px-2"
                        >
                          Halaman {pageNumber}
                        </Button>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            )}
            {canBulkPay && isBulkMode && bulkUnpaidIds.length > 0 && (
              <Button
                disabled={mutating}
                onClick={() => setShowBulkDialog(true)}
                color="green"
                className="shrink-0 whitespace-nowrap"
              >
                Bayar ({bulkUnpaidIds.length})
              </Button>
            )}
            {canBulkPay && canCancelPembayaran && isBulkMode && bulkPaidIds.length > 0 && (
              <Button
                disabled={mutating}
                onClick={() => setShowBulkRevertDialog(true)}
                color="amber"
                className="shrink-0 whitespace-nowrap"
              >
                Batalkan bayar ({bulkPaidIds.length})
              </Button>
            )}
            {user.role === "Superadmin" &&
              isBulkMode &&
              bulkUnpaidIds.length > 0 && (
                <Button
                  disabled={mutating}
                  onClick={() => setShowBulkDeleteDialog(true)}
                  color="slatesky"
                  className="shrink-0 whitespace-nowrap"
                >
                  Hapus tagihan ({bulkUnpaidIds.length})
                </Button>
              )}
            {user.role === "Superadmin" && canHapusSemuaBulan && (
              <Button
                disabled={mutating}
                onClick={() => setShowResetTagihanBulanDialog(true)}
                color="red"
                className="shrink-0 whitespace-nowrap"
              >
                Reset DB (bulan)
              </Button>
            )}
            {user.role === "Superadmin" && canHapusSemuaBulan && (
              <Button
                disabled={mutating}
                onClick={() => setShowHapusSemuaBulanDialog(true)}
                color="amber"
                className="shrink-0 whitespace-nowrap"
              >
                Reset DB (bulan) belum bayar
              </Button>
            )}
            {user.role === "Superadmin" && (
              <Button
                disabled={mutating}
                onClick={() => setShowHapusBelumBayarBulanIniDialog(true)}
                color="amber"
                className="shrink-0 whitespace-nowrap"
              >
                Hapus belum bayar bulan ini
              </Button>
            )}
            {user.role === "Superadmin" && (
              <Button
                disabled={mutating}
                onClick={() => setShowBersihkanDuplikatDialog(true)}
                color="cyan"
                className="shrink-0 whitespace-nowrap"
              >
                Bersihkan duplikat
              </Button>
            )}
            {user.role === "Superadmin" && (
              <Button
                disabled={mutating}
                onClick={() => setShowResetTagihanMitraDialog(true)}
                color="red"
                className="shrink-0 whitespace-nowrap"
              >
                Reset DB (semua bulan)
              </Button>
            )}
            {user.role === "Superadmin" && (
              <Button
                disabled={mutating}
                onClick={() => setShowBersihkanTanpaPppDialog(true)}
                color="red100"
                className="shrink-0 whitespace-nowrap"
              >
                Bersihkan tanpa PPP
              </Button>
            )}
            {canBulkPay ? (
            <Button
              disabled={mutating}
              onClick={() => {
                setIsBulkMode(!isBulkMode);
                setBulkUnpaidIds([]);
                setBulkPaidIds([]);
                setShowBulkDeleteDialog(false);
              }}
              color={isBulkMode ? "red" : "slatesky"}
              className="hidden shrink-0 whitespace-nowrap !px-3 md:inline-flex"
            >
              {isBulkMode ? "Batal" : "Bayar Masal"}
            </Button>
            ) : null}
            <Button
              disabled={mutating}
              onClick={() => setShowPaketDialog(true)}
              color="slatesky"
              className="hidden shrink-0 whitespace-nowrap !px-3 md:inline-flex"
            >
              Hitungan Per Paket
            </Button>
            {user.role === "Superadmin" && (
              <Button
                disabled={mutating || !canHapusSemuaBulan}
                onClick={() => setShowGenerateDialog(true)}
                color="sky"
                className="shrink-0 whitespace-nowrap"
              >
                Generate Tagihan
              </Button>
            )}
          </div>
          {!isPetugasApp && tampilFilter ? (
            <div className="order-3 flex w-full flex-col items-stretch gap-2 max-md:rounded-2xl max-md:border max-md:border-slate-200 max-md:bg-white max-md:p-3 max-md:shadow-sm dark:max-md:border-theme-border dark:max-md:bg-theme-card md:order-none md:col-span-3 md:row-start-2 md:flex-row md:flex-nowrap md:items-center md:overflow-x-auto md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
              {routerOptions.length > 1 ? (
                <label className="flex w-full items-center gap-2 text-sm text-slate-700 dark:text-theme-fg md:w-auto md:shrink-0">
                  <span className="shrink-0">Router:</span>
                  <select
                    className="h-12 w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 shadow-sm dark:border-theme-border dark:bg-theme-card dark:text-theme-fg md:h-auto md:w-[12rem] md:flex-none md:rounded-lg md:py-2 md:text-sm md:shadow-none"
                    value={filterRouter}
                    onChange={(e) => setFilterRouter(e.target.value)}
                    disabled={mutating}
                    aria-label="Filter router"
                  >
                    <option value="">Semua router</option>
                    {routerOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.nama}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {tampilFilter ? (
                <label className="flex w-full items-center gap-2 text-sm text-slate-700 dark:text-theme-fg md:w-auto md:shrink-0">
                  <span className="shrink-0">Bayar:</span>
                  <select
                    className="h-12 w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 shadow-sm dark:border-theme-border dark:bg-theme-card dark:text-theme-fg md:h-auto md:w-[9.5rem] md:flex-none md:rounded-lg md:py-2 md:text-sm md:shadow-none"
                    value={
                      filterMetode === "Cash" || filterMetode === "Transfer"
                        ? filterMetode
                        : filterBayarBulan === "belum" || filterBayarBulan === "terbayar"
                          ? filterBayarBulan
                          : "semua"
                    }
                    onChange={(e) => {
                      const next = e.target.value;
                      setFilterBank(null);
                      if (next === "Cash" || next === "Transfer") {
                        setFilterMetode(next);
                        setFilterBayarBulan("semua");
                      } else {
                        setFilterMetode(null);
                        setFilterBayarBulan(
                          next === "belum" || next === "terbayar" ? next : "semua"
                        );
                      }
                      setPage(1);
                    }}
                    disabled={mutating}
                    aria-label="Filter status pembayaran pada bulan yang dipilih"
                  >
                    <option value="semua">Semua</option>
                    <option value="terbayar">Sudah bayar</option>
                    <option value="belum">Belum bayar</option>
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </label>
              ) : null}
              {tampilFilter ? (
                <label className="flex w-full items-center gap-2 text-sm text-slate-700 dark:text-theme-fg md:w-auto md:shrink-0">
                  <span className="shrink-0">Isolir:</span>
                  <select
                    className="h-12 w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 shadow-sm dark:border-theme-border dark:bg-theme-card dark:text-theme-fg md:h-auto md:w-[9rem] md:flex-none md:rounded-lg md:py-2 md:text-sm md:shadow-none"
                    value={filterIsolir}
                    onChange={(e) =>
                      setFilterIsolir(e.target.value as StatusIsolirFilter)
                    }
                    disabled={mutating}
                    aria-label="Filter status isolir PPP pelanggan"
                  >
                    <option value="semua">Semua</option>
                    <option value="isolir">Isolir</option>
                    <option value="aktif">Aktif</option>
                  </select>
                </label>
              ) : null}
              {tampilFilter ? (
                <label className="flex w-full items-center gap-2 text-sm text-slate-700 dark:text-theme-fg md:w-auto md:shrink-0">
                  <span className="shrink-0">Penagih:</span>
                  <select
                    className="h-12 w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 shadow-sm dark:border-theme-border dark:bg-theme-card dark:text-theme-fg md:h-auto md:w-[12rem] md:flex-none md:rounded-lg md:py-2 md:text-sm md:shadow-none"
                    value={filterPenagih}
                    onChange={(e) =>
                      setFilterPenagih(e.target.value as StatusPenagihFilter)
                    }
                    disabled={mutating}
                    aria-label="Filter pelanggan menurut nama penagih"
                  >
                    <option value="semua">Semua penagih</option>
                    {isPenagihView ? null : (
                      <option value="tanpa">Tanpa penagih</option>
                    )}
                    {penagihOptions.map((row) => (
                      <option key={row.id} value={String(row.id)}>
                        {row.aktif ? row.nama : `${row.nama} nonaktif`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {tampilFilter && /^\d+$/.test(filterPenagih) && /^\d{4}-\d{2}$/.test(bulan.trim()) ? (
                <Button
                  color="slatesky"
                  className="shrink-0 rounded p-2"
                  title="Cetak berkas penagihan"
                  aria-label="Cetak berkas penagihan"
                  onClick={() => {
                    const params = new URLSearchParams({
                      periode: bulan.trim(),
                      penagihId: filterPenagih,
                      mitraId: String(id),
                    });
                    window.open(
                      `/petugas/cetak?${params.toString()}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                >
                  <TbPrinter className="size-4" />
                </Button>
              ) : null}
              {showStaffFilter && staffTerbatas.length > 0 ? (
                <label className="flex w-full items-center gap-2 text-sm text-slate-700 dark:text-theme-fg md:w-auto md:shrink-0">
                  <span className="shrink-0">Staff:</span>
                  <select
                    className="h-12 w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 shadow-sm dark:border-theme-border dark:bg-theme-card dark:text-theme-fg md:h-auto md:w-[9rem] md:flex-none md:rounded-lg md:py-2 md:text-sm md:shadow-none"
                    value={staffAs ?? ""}
                    onChange={(e) => applyStaffFilter(e.target.value)}
                    disabled={mutating}
                    aria-label="Filter PPPoE menurut staff yang mengelola"
                  >
                    <option value="">Semua</option>
                    {staffTerbatas.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.nama}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      <div className="flex flex-col gap-1 w-full self-stretch -mt-2">
        <div
          className={cn(
            "flex w-full min-w-0 flex-col gap-2 max-md:rounded-2xl max-md:bg-white max-md:p-3 max-md:shadow-sm dark:max-md:bg-theme-card md:flex-row md:items-center md:justify-between md:rounded-none md:bg-transparent md:p-0 md:shadow-none",
            isPetugasApp && "hidden"
          )}
        >
          {listPaginationBar}
            <div
            className={cn(
              "flex shrink-0 flex-wrap justify-center gap-3 text-xs max-md:w-full sm:justify-end sm:gap-8 sm:text-sm md:w-auto md:justify-end",
              "text-slate-700 dark:text-theme-fg",
              "*:flex *:items-center *:gap-1",
              isPetugasApp && "hidden"
            )}
          >
            <div>
              <div className="size-4 shrink-0 rounded-sm bg-yellow-300 dark:bg-amber-400 inline-block mr-1" />
              Belum
            </div>
            <div>
              <div className="size-4 shrink-0 rounded-sm bg-red-500 dark:bg-red-600 inline-block mr-1" />
              Tidak Terbayar
            </div>
            <div>
              <div className="size-4 shrink-0 rounded-sm bg-green-500 dark:bg-green-600 inline-block mr-1" />
              Terbayar
            </div>
          </div>
        </div>
      <section className={cn("flex flex-col gap-3 w-full", !isPetugasApp && "md:hidden")}>
        {mutating ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="flex w-full animate-pulse flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
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
              <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                <div className="h-10 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : isBelumInputView && pppBelumInput.length > 0 ? (
          <>
            <p className="text-xs text-violet-800 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2">
              User PPP berikut belum punya data pelanggan (sama tab{" "}
              <span className="font-medium">Belum</span> di PPPoE).
            </p>
            <PppBelumInputList
              rows={pppBelumInput}
              page={page}
              pageLimit={pageLimit}
            />
          </>
        ) : listPelanggan && listPelanggan.length > 0 ? (
          listPelanggan.map((val, idx) => {
            const nomor = (page - 1) * pageLimit + idx + 1;
            const displayAmount = tagihanBulananDariPaket(val.paket);
            const pemb = findPembayaranBulanTerpilih(val.pembayaran);
            
            if (isPetugasApp) {
              const statusIsolir = petugasStatusIsolir(val);
              const nomorHp = val.nomor?.trim();
              const nomorTampil =
                nomorHp && nomorHp !== "-" ? nomorHp : null;
              return (
                <button
                  key={val.id}
                  type="button"
                  disabled={
                    !pemb ||
                    (!petugasBolehBayarBulanIni && pemb.status !== "Terbayar")
                  }
                  onClick={() => {
                    if (!pemb) return;
                    if (
                      !petugasBolehBayarBulanIni &&
                      pemb.status !== "Terbayar"
                    ) {
                      return;
                    }
                    openPembayaranDialog(val, pemb);
                  }}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left shadow-sm active:scale-[0.99] disabled:active:scale-100",
                    !pemb &&
                      "border-slate-200 bg-slate-50 dark:border-theme-border dark:bg-theme-card",
                    pemb?.status === "Terbayar" &&
                      "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
                    pemb?.status === "Belum" &&
                      isBelumBayarMasihBulanTagihan(pemb) &&
                      "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
                    pemb?.status === "Belum" &&
                      !isBelumBayarMasihBulanTagihan(pemb) &&
                      "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-slate-900 dark:text-theme-fg">
                        {val.nama}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-theme-fg-muted">
                        {val.alamat?.trim() || "Alamat belum diisi"}
                      </p>
                      {nomorTampil ? (
                        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-theme-fg">
                          {nomorTampil}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className="text-base font-semibold tabular-nums text-slate-800 dark:text-theme-fg">
                        {displayAmount.toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        })}
                      </p>
                      {statusIsolir ? (
                        <p
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            statusIsolir.tone === "isolir" &&
                              "bg-red-500 text-white",
                            statusIsolir.tone === "berhenti" &&
                              "bg-slate-500 text-white",
                            statusIsolir.tone === "jadwal" &&
                              "bg-slate-100 text-slate-600 dark:bg-theme-elevated dark:text-theme-fg-muted"
                          )}
                        >
                          {statusIsolir.text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "mt-4 flex h-12 items-center justify-center rounded-xl text-base font-semibold",
                      pembayaranStatusCellClass(pemb)
                    )}
                  >
                    {pemb
                      ? pemb.status === "Terbayar"
                        ? pembayaranBayarSekaligusLabel(pemb.bayarSekaligus) ??
                          "Lunas"
                        : petugasBolehBayarBulanIni
                          ? "Bayar"
                          : "Belum"
                      : "Belum ada tagihan"}
                  </div>
                </button>
              );
            }

            return (
              <div
                key={val.id}
                className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-theme-border dark:bg-theme-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-tight text-slate-900 dark:text-theme-fg">
                      <span className="mr-1 text-sm font-medium text-slate-400">{nomor}.</span>
                      {val.nama}
                    </p>
                    {renderNoLayananUnderNama(val)}
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-theme-fg-muted">
                      {val.alamat?.trim() || "Alamat belum diisi"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-base font-semibold tabular-nums text-slate-800 dark:text-theme-fg">
                      {displayAmount.toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className="text-[10px] text-slate-400">/bulan</span>
                    {renderNoInvoiceUnderHarga(pemb)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600 dark:text-theme-fg-muted">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-theme-elevated">
                    {val.router.nama}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-theme-elevated">
                    {val.ppp_secret?.name || "Tanpa PPP"}
                  </span>
                  {showPenagihColumn ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-theme-elevated">
                      {renderPenagihNama(val)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col items-start gap-1 text-xs text-slate-500">
                    {renderTglBerlanggananUnderPpp(val.tgl)}
                    {renderTglIsolirCell(val)}
                  </div>
                  {renderAksiButtons(val, pemb)}
                </div>
                {(() => {
                  const statusClass = pembayaranStatusCellClass(pemb);
                  if (!pemb) {
                    return (
                      <div
                        className={cn(
                          "flex h-12 items-center justify-center rounded-xl text-sm font-semibold",
                          statusClass
                        )}
                      >
                        {tagihanKosongLabel(
                          val,
                          bulan || undefined,
                          mitraBillingStartMode,
                          mitraBillingStartDate,
                          mitraOwnedByIsp
                        )}
                      </div>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isBulkMode) {
                          if (pemb.status === "Terbayar") {
                            if (canCancelPembayaran) {
                              togglePaidSelection(pemb.id);
                            } else {
                              openPembayaranDialog(val, pemb);
                            }
                          } else {
                            toggleUnpaidSelection(pemb.id);
                          }
                        } else {
                          openPembayaranDialog(val, pemb);
                        }
                      }}
                      className={cn(
                        "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold active:scale-[0.99]",
                        statusClass,
                        pemb.status === "Terbayar"
                          ? bulkPaidIds.includes(pemb.id) &&
                              "ring-2 ring-offset-1 ring-amber-500"
                          : bulkUnpaidIds.includes(pemb.id) &&
                              "ring-2 ring-offset-1 ring-sky-500"
                      )}
                    >
                      {isBulkMode ? (
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded border",
                            pemb.status === "Terbayar"
                              ? bulkPaidIds.includes(pemb.id)
                                ? "border-amber-600 bg-amber-600 text-white"
                                : "border-slate-500 bg-white"
                              : bulkUnpaidIds.includes(pemb.id)
                                ? "border-sky-600 bg-sky-600 text-white"
                                : "border-slate-500 bg-white"
                          )}
                        >
                          {(pemb.status === "Terbayar"
                            ? bulkPaidIds.includes(pemb.id)
                            : bulkUnpaidIds.includes(pemb.id)) && (
                            <Check className="size-3" strokeWidth={3} />
                          )}
                        </span>
                      ) : (
                        <PembayaranStatusLabel pemb={pemb} />
                      )}
                    </button>
                  );
                })()}
                {showInputterCol &&
                pemb?.status === "Terbayar" &&
                (pemb.inputter || pemb.viaTripay) ? (
                  <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
                    Diproses {formatPembayaranProcessorLabel(pemb.inputter, pemb.viaTripay)}
                    {formatPembayaranProcessedAt(pemb.processedAt)
                      ? ` · ${formatPembayaranProcessedAt(pemb.processedAt)}`
                      : ""}
                  </p>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500 border border-slate-200 border-dashed">
            <p className="text-sm">
              {listEmptyMessage}
            </p>
          </div>
        )}
      </section>
      {isBelumInputView && !mutating ? (
        <section className="hidden md:block w-full space-y-2">
          {pppBelumInput.length > 0 ? (
            <>
              <p className="text-xs text-violet-800 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2">
                User PPP berikut belum punya data pelanggan (segera update{" "}
                <span className="font-medium">di</span> halaman PPPoE).
              </p>
              <PppBelumInputList
                rows={pppBelumInput}
                page={page}
                pageLimit={pageLimit}
              />
            </>
          ) : (
            <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500 border border-slate-200 border-dashed">
              <p className="text-sm">
                {listEmptyMessage}
              </p>
            </div>
          )}
        </section>
      ) : (
      <section
        className={cn(
          "w-full overflow-x-auto rounded text-sm shadow",
          isPetugasApp ? "hidden" : "hidden md:block"
        )}
      >
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="divide-x divide-slate-50 dark:divide-theme-border/50 bg-slate-300/70 *:px-4 *:py-2">
              <td>No.</td>
              <td>Router</td>
              <td>Nama</td>
              {showPenagihColumn ? <td>Penagih</td> : null}
              <td>PPP</td>
              <td className="text-center min-w-[4.5rem]">Tgl Isolir</td>
              <td className="max-w-24">Tagihan Bulanan</td>
              <td>Alamat</td>
              <td
                className={cn(
                  "text-center min-w-[7rem] !p-0",
                  sortBayar === "belum" && "bg-sky-600 dark:bg-sky-700"
                )}
              >
                {renderUrutanBelum("cell")}
              </td>
              {showInputterCol ? (
                <td
                  className={cn(
                    "text-center min-w-[9.5rem] !p-0",
                    sortDiproses === "tanggal" && "bg-sky-600 dark:bg-sky-700"
                  )}
                >
                  {renderDiprosesOlehSort("cell")}
                </td>
              ) : null}
              <td className="text-center min-w-[6.5rem]">Aksi</td>
            </tr>
          </thead>
          <tbody>
            {mutating ? (
              <LoadingDataTable
                withAksiColumn
                withInputterColumn={showInputterCol}
                withPenagihColumn={showPenagihColumn}
              />
            ) : listPelanggan && listPelanggan.length > 0 ? (
              listPelanggan.map((val, idx) => {
                const nomor = (page - 1) * pageLimit + idx + 1;
                const displayAmount = tagihanBulananDariPaket(val.paket);
                const pemb = findPembayaranBulanTerpilih(val.pembayaran);
                
                return (
                  <tr
                    className="bg-slate-50/80 dark:bg-theme-card/30 hover:text-sky-600 divide-x divide-y divide-slate-100 dark:divide-theme-border/40"
                    key={val.id}
                  >
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {nomor + "."}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.router.nama}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.nama}
                      {renderNoLayananUnderNama(val)}
                    </td>
                    {showPenagihColumn ? (
                      <td className="whitespace-pre-wrap px-4 py-2">
                        {renderPenagihNama(val)}
                      </td>
                    ) : null}
                    <td className="whitespace-pre-wrap px-4 py-2">
                      <span>{val.ppp_secret?.name || "-"}</span>
                      {renderTglBerlanggananUnderPpp(val.tgl)}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        {renderTglIsolirCell(val)}
                      </div>
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {displayAmount.toLocaleString(
                        "id-ID",
                        {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        }
                      )}
                      {renderNoInvoiceUnderHarga(pemb)}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {val.alamat}
                    </td>
                    {(() => {
                      const pembParts = pemb
                        ? parseJatuhTempoParts(pemb.jatuh_tempo)
                        : null;
                      return (
                        <td
                          className={cn(
                            "text-center min-w-[7rem]",
                            pembayaranStatusBg(pemb)
                          )}
                        >
                          <Tooltip
                            className="w-full"
                            title={
                              !isBulkMode && pemb?.id ? (
                                <dl>
                                  <dt>Jatuh Tempo:</dt>
                                  <dd>
                                    {new Intl.DateTimeFormat("id-ID", {
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    }).format(
                                      new Date(
                                        pembParts!.year,
                                        pembParts!.month - 1,
                                        pembParts!.day
                                      )
                                    )}
                                  </dd>
                                  <dt>Total:</dt>
                                  <dd>
                                    {pemb?.total.toLocaleString("id-ID", {
                                      style: "currency",
                                      currency: "IDR",
                                      maximumFractionDigits: 0,
                                    })}
                                  </dd>
                                  {pemb.status === "Terbayar" && pemb.metode ? (
                                    <>
                                      <dt>Metode:</dt>
                                      <dd>{pemb.metode}</dd>
                                    </>
                                  ) : null}
                                  {pembayaranTransferBankName(pemb) ? (
                                    <>
                                      <dt>Bank:</dt>
                                      <dd>{pembayaranTransferBankName(pemb)}</dd>
                                    </>
                                  ) : null}
                                  {showInputterCol && pemb.status === "Terbayar" ? (
                                    <>
                                      <dt>Diproses oleh:</dt>
                                      <dd>
                                        {formatPembayaranProcessorLabel(
                                          pemb.inputter,
                                          pemb.viaTripay
                                        )}
                                      </dd>
                                      {formatPembayaranProcessedAt(
                                        pemb.processedAt
                                      ) ? (
                                        <>
                                          <dt>Tanggal:</dt>
                                          <dd>
                                            {formatPembayaranProcessedAt(
                                              pemb.processedAt
                                            )}
                                          </dd>
                                        </>
                                      ) : null}
                                    </>
                                  ) : null}
                                </dl>
                              ) : null
                            }
                            disableHoverListener={isBulkMode}
                            disableFocusListener={isBulkMode}
                            disableTouchListener={isBulkMode}
                          >
                            {pemb ? (
                              <button
                                type="button"
                                className={cn(
                                  "focus:outline-none w-full min-h-10 flex items-center justify-center px-2 text-xs font-medium",
                                  pemb.status === "Terbayar"
                                    ? "text-white"
                                    : pemb.status === "Belum" &&
                                        isBelumBayarMasihBulanTagihan(pemb)
                                      ? "text-yellow-900 dark:text-yellow-950"
                                      : "text-white",
                                  pemb.status === "Terbayar"
                                    ? bulkPaidIds.includes(pemb.id) &&
                                      "bg-amber-200/50"
                                    : bulkUnpaidIds.includes(pemb.id) &&
                                      "bg-sky-200/50"
                                )}
                                onClick={() => {
                                  if (isBulkMode) {
                                    if (pemb.status === "Terbayar") {
                                      if (canCancelPembayaran) {
                                        togglePaidSelection(pemb.id);
                                      } else {
                                        openPembayaranDialog(val, pemb);
                                      }
                                    } else {
                                      toggleUnpaidSelection(pemb.id);
                                    }
                                  } else {
                                    openPembayaranDialog(val, pemb);
                                  }
                                }}
                              >
                                {isBulkMode ? (
                                  <div
                                    className={cn(
                                      "w-4 h-4 rounded border flex items-center justify-center transition-all shadow-sm",
                                      pemb.status === "Terbayar"
                                        ? bulkPaidIds.includes(pemb.id)
                                          ? "bg-amber-600 border-amber-600 text-white"
                                          : "bg-white border-slate-400"
                                        : bulkUnpaidIds.includes(pemb.id)
                                          ? "bg-sky-600 border-sky-600 text-white"
                                          : "bg-white border-slate-400"
                                    )}
                                  >
                                    {(pemb.status === "Terbayar"
                                      ? bulkPaidIds.includes(pemb.id)
                                      : bulkUnpaidIds.includes(pemb.id)) && (
                                      <Check
                                        className="w-3 h-3"
                                        strokeWidth={3}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <PembayaranStatusLabel pemb={pemb} />
                                )}
                              </button>
                            ) : (
                              <div className="min-h-10 flex items-center justify-center text-slate-400 text-[10px] sm:text-xs">
                                {tagihanKosongLabel(
                                  val,
                                  bulan || undefined,
                                  mitraBillingStartMode,
                                  mitraBillingStartDate,
                                  mitraOwnedByIsp
                                )}
                              </div>
                            )}
                          </Tooltip>
                        </td>
                      );
                    })()}
                    {showInputterCol ? (
                      <td className="whitespace-pre-wrap px-4 py-2 text-center text-xs">
                        {renderProcessorInfo(pemb)}
                      </td>
                    ) : null}
                    <td className="whitespace-pre-wrap px-4 py-2">
                      {renderAksiButtons(val, pemb)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-slate-50/80">
                <td colSpan={showInputterCol ? 11 : 10}>
                  <p className="px-4 py-6 text-center text-slate-500">
                    {listEmptyMessage}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      )}
      </div>
      <div className="self-start w-full mt-1">{listPaginationBar}</div>
      <DialogPembayaran
        state={pembayaranDialog}
        dispatch={pembayaranDialogDispatch}
        loadData={loadData}
        role={user.role}
        canPayViaBank={canPayViaBank}
        canCancel={canCancelPembayaran}
        sheet={isPetugasApp}
      />
      <DialogHitunganPaket
        data={hitunganPaketData}
        show={showPaketDialog}
        setShow={setShowPaketDialog}
        ppn={
          hitunganPaketPpnEnabled
            ? (hitunganPaketPpn ?? mitraPpn ?? user.ppn)
            : 0
        }
        showPpn={hitunganPaketPpnEnabled && mitraPpnEnabled}
        regulatory={hitunganPaketRegulatory}
        loading={loadingHitunganPaket}
      />
      {user.role === "Superadmin" && (
        <DialogGenerate
          isOpen={showGenerateDialog}
          close={() => setShowGenerateDialog(false)}
          onConfirm={handleGenerate}
          mutating={mutatingGenerate}
          periodLabel={selectedMonthLabelForGenerate || undefined}
        />
      )}
      {canBulkPay ? (
      <DialogBulkPembayaran
        ids={bulkUnpaidIds}
        show={showBulkDialog}
        onClose={() => {
          setShowBulkDialog(false);
          setIsBulkMode(false);
          setBulkUnpaidIds([]);
          setBulkPaidIds([]);
        }}
        loadData={loadData}
        canPayViaBank={canPayViaBank}
      />
      ) : null}
      {canBulkPay ? (
      <DialogBulkBatalBayar
        ids={bulkPaidIds}
        show={showBulkRevertDialog}
        onClose={() => {
          setShowBulkRevertDialog(false);
          setIsBulkMode(false);
          setBulkUnpaidIds([]);
          setBulkPaidIds([]);
        }}
        loadData={loadData}
      />
      ) : null}
      <DialogBulkHapusTagihan
        ids={bulkUnpaidIds}
        show={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        loadData={loadData}
        onDeleted={() => setBulkUnpaidIds([])}
      />
      <DialogHapusSemuaTagihan
        mitraUserId={id}
        bulan={bulan}
        show={showHapusSemuaBulanDialog}
        onClose={() => setShowHapusSemuaBulanDialog(false)}
        loadData={loadData}
      />
      <DialogBersihkanTanpaPpp
        mitraUserId={id}
        show={showBersihkanTanpaPppDialog}
        onClose={() => setShowBersihkanTanpaPppDialog(false)}
        loadData={loadData}
      />
      <DialogBersihkanDuplikatTagihan
        mitraUserId={id}
        bulan={canHapusSemuaBulan ? bulan : undefined}
        show={showBersihkanDuplikatDialog}
        onClose={() => setShowBersihkanDuplikatDialog(false)}
        loadData={loadData}
      />
      <DialogHapusBelumBayarBulanIni
        mitraUserId={id}
        show={showHapusBelumBayarBulanIniDialog}
        onClose={() => setShowHapusBelumBayarBulanIniDialog(false)}
        loadData={loadData}
      />
      <DialogResetTagihanBulan
        mitraUserId={id}
        bulan={bulan}
        show={showResetTagihanBulanDialog}
        onClose={() => setShowResetTagihanBulanDialog(false)}
        loadData={loadData}
      />
      <DialogResetTagihanMitra
        mitraUserId={id}
        show={showResetTagihanMitraDialog}
        onClose={() => setShowResetTagihanMitraDialog(false)}
        loadData={loadData}
      />
      <DialogBerhentiPelanggan
        show={showBerhentiDialog}
        setShow={setShowBerhentiDialog}
        data={berhentiTarget}
        onSuccess={() => loadData({ refreshStats: true, silent: true })}
      />
      <DialogHapusUserPppoe
        target={hapusPppTarget}
        mitraUserId={id}
        show={showHapusPppDialog}
        onClose={() => setShowHapusPppDialog(false)}
        loadData={loadData}
      />
      <DialogResumePelanggan
        show={showResumeDialog}
        setShow={setShowResumeDialog}
        data={resumeTarget}
        onSuccess={() => loadData({ refreshStats: true, silent: true })}
      />
    </>
  );
}
