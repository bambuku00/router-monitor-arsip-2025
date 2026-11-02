"use client";

import FormPinPelanggan from "@/components/pppoe-portal/form-pin";
import PanelTiket from "@/components/pppoe-portal/panel-tiket";
import TombolBayar from "@/components/pppoe-portal/bayar-tripay";
import { keluarPelangganPppoe } from "@/lib/server-actions/pelanggan-portal-actions";
import type { PortalAccount } from "@/lib/pelanggan-portal";
import type { PortalTiketItem } from "@/lib/portal-tiket";
import { formatCurrency } from "@/lib/utils";
import Logo from "@/public/logo.png";
import Image from "next/image";
import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import {
  MdConfirmationNumber,
  MdHome,
  MdLogout,
  MdPerson,
  MdReceiptLong,
  MdWifi,
  MdWifiOff,
} from "react-icons/md";

type Tab = "beranda" | "tagihan" | "tiket" | "akun";

const tabs: { id: Tab; label: string; icon: typeof MdHome }[] = [
  { id: "beranda", label: "Beranda", icon: MdHome },
  { id: "tagihan", label: "Tagihan", icon: MdReceiptLong },
  { id: "tiket", label: "Tiket", icon: MdConfirmationNumber },
  { id: "akun", label: "Akun", icon: MdPerson },
];

export default function DasborPortal({
  akun,
  tiket,
}: {
  akun: PortalAccount;
  tiket: PortalTiketItem[];
}) {
  const [tab, setTab] = useState<Tab>("beranda");
  const belum = akun.tagihan.filter((item) => !item.lunas).length;
  const terbuka = tiket.filter((item) => item.status !== "selesai").length;
  const terbaru = akun.tagihan.find((item) => !item.lunas) ?? akun.tagihan[0];

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#f2f4f7] text-slate-900 lg:h-auto lg:min-h-dvh lg:overflow-visible dark:bg-[#121212] dark:text-slate-100">
      <header className="shrink-0 bg-[#c62828] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white shadow-md lg:px-8 lg:py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="min-w-0">
            <Image
              src={Logo}
              alt="WINET"
              className="mb-1.5 h-8 w-auto rounded-md bg-white px-1.5 py-0.5"
              priority
            />
            <p className="truncate text-base font-medium leading-tight">{akun.nama}</p>
            <p className="truncate text-sm tracking-wide text-red-100">{akun.nomor}</p>
          </div>
          <nav
            className={
              akun.csWaUrl
                ? "hidden min-w-0 flex-1 items-center gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr]"
                : "hidden items-center gap-1 lg:flex"
            }
          >
            <div className={akun.csWaUrl ? "flex justify-end gap-1" : "contents"}>
              {(akun.csWaUrl ? tabs.filter((item) => item.id !== "akun") : tabs).map((item) => (
                <TombolTab
                  key={item.id}
                  item={item}
                  active={tab === item.id}
                  belum={belum}
                  terbuka={terbuka}
                  variant="header"
                  onClick={() => setTab(item.id)}
                />
              ))}
            </div>
            {akun.csWaUrl ? (
              <>
                <TautanWa href={akun.csWaUrl} nomor={akun.csWa ?? ""} variant="header" />
                <div className="flex justify-start">
                  <TombolTab
                    item={tabs[3]}
                    active={tab === "akun"}
                    belum={belum}
                    terbuka={terbuka}
                    variant="header"
                    onClick={() => setTab("akun")}
                  />
                </div>
              </>
            ) : null}
          </nav>
          <form action={keluarPelangganPppoe}>
            <button
              type="submit"
              aria-label="Keluar"
              className="flex size-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25 lg:h-10 lg:w-auto lg:gap-2 lg:px-4"
            >
              <MdLogout className="size-5" />
              <span className="hidden text-sm font-medium lg:inline">Keluar</span>
            </button>
          </form>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:overflow-visible lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 lg:mb-4 dark:bg-amber-950/40 dark:text-amber-100">
            Internet terasa lambat? Coba matikan dan nyalakan kembali (restart) modem Anda selama 30
            detik sebelum menghubungi kami.
          </p>
          {tab === "beranda" ? (
            <Beranda akun={akun} terbaru={terbaru} onTagihan={() => setTab("tagihan")} />
          ) : null}
          {tab === "tagihan" ? <Tagihan akun={akun} /> : null}
          {tab === "tiket" ? (
            <PanelTiket tiket={tiket} nomorTerdaftar={akun.nomor} />
          ) : null}
          {tab === "akun" ? <Akun akun={akun} /> : null}
        </div>
      </div>

      <nav
        className={`grid shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-white/10 dark:bg-[#1e1e1e] ${
          akun.csWaUrl ? "grid-cols-5" : "grid-cols-4"
        }`}
      >
        {tabs
          .filter((item) => item.id !== "akun")
          .map((item) => (
            <TombolTab
              key={item.id}
              item={item}
              active={tab === item.id}
              belum={belum}
              terbuka={terbuka}
              variant="bawah"
              onClick={() => setTab(item.id)}
            />
          ))}
        {akun.csWaUrl ? (
          <TautanWa href={akun.csWaUrl} nomor={akun.csWa ?? ""} variant="bawah" />
        ) : null}
        <TombolTab
          item={tabs[3]}
          active={tab === "akun"}
          belum={belum}
          terbuka={terbuka}
          variant="bawah"
          onClick={() => setTab("akun")}
        />
      </nav>
    </div>
  );
}

function Beranda({
  akun,
  terbaru,
  onTagihan,
}: {
  akun: PortalAccount;
  terbaru: PortalAccount["tagihan"][number] | undefined;
  onTagihan: () => void;
}) {
  const online = akun.koneksi === "Online";
  return (
    <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
      <section className="grid grid-cols-2 gap-3 lg:contents">
        <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-[#1e1e1e]">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Status
          </p>
          <p
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-white ${statusClass(akun.status)}`}
          >
            {akun.status}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-[#1e1e1e]">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Koneksi
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
            {online ? (
              <MdWifi className="size-5 text-emerald-600" />
            ) : (
              <MdWifiOff className="size-5 text-slate-400" />
            )}
            {akun.koneksi}
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#1e1e1e]">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Paket
        </p>
        <p className="mt-1 text-lg font-medium">{akun.paketNama}</p>
        <p className="text-sm text-slate-500">{akun.kapasitas} Mbps</p>
        <p className="mt-3 text-2xl font-medium tabular-nums text-[#c62828]">
          {formatCurrency(akun.paketHarga)}
        </p>
        <p className="text-xs text-slate-500">per bulan</p>
      </section>

      {terbaru ? (
        <button
          type="button"
          onClick={onTagihan}
          className="rounded-2xl bg-white p-4 text-left shadow-sm active:bg-slate-50 lg:col-span-3 dark:bg-[#1e1e1e] dark:active:bg-[#2a2a2a]"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Tagihan terbaru
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-base font-medium capitalize">{terbaru.periode}</p>
              <p className="text-xs text-slate-500">INV {terbaru.noInvoice}</p>
            </div>
            <div className="text-right">
              <p className="text-base font-medium tabular-nums">
                {formatCurrency(terbaru.total)}
              </p>
              <p
                className={`text-xs font-semibold ${terbaru.lunas ? "text-emerald-600" : "text-amber-600"}`}
              >
                {terbaru.lunas ? "Lunas" : "Belum bayar"}
              </p>
            </div>
          </div>
        </button>
      ) : (
        <section className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm lg:col-span-3 dark:bg-[#1e1e1e]">
          Belum ada tagihan.
        </section>
      )}

    </div>
  );
}

function TombolTab({
  item,
  active,
  belum,
  terbuka,
  onClick,
  variant,
}: {
  item: (typeof tabs)[number];
  active: boolean;
  belum: number;
  terbuka: number;
  onClick: () => void;
  variant: "header" | "bawah";
}) {
  const Icon = item.icon;
  const badge = item.id === "tagihan" ? belum : item.id === "tiket" ? terbuka : 0;
  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
          active ? "bg-white text-[#c62828]" : "text-red-100 hover:bg-white/10"
        }`}
      >
        <Icon className="size-5" />
        {item.label}
        {badge > 0 ? (
          <span
            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${
              active ? "bg-[#c62828] text-white" : "bg-white text-[#c62828]"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
        active ? "text-[#c62828]" : "text-slate-500 dark:text-slate-400"
      }`}
    >
      <span
        className={`relative flex h-8 w-12 items-center justify-center rounded-full ${
          active ? "bg-red-100 dark:bg-red-950" : ""
        }`}
      >
        <Icon className="size-5" />
        {badge > 0 ? (
          <span className="absolute -right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c62828] px-1 text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </span>
      {item.label}
    </button>
  );
}

function TautanWa({
  href,
  nomor,
  variant,
}: {
  href: string;
  nomor: string;
  variant: "header" | "bawah";
}) {
  if (variant === "header") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Hub CS ${nomor}`}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-red-100 hover:bg-white/10"
      >
        <FaWhatsapp className="size-5 text-[#25D366]" />
        Hub CS
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Hub CS ${nomor}`}
      className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500 dark:text-slate-400"
    >
      <span className="flex h-8 w-12 items-center justify-center rounded-full">
        <FaWhatsapp className="size-5 text-[#25D366]" />
      </span>
      Hub CS
    </a>
  );
}

function Tagihan({ akun }: { akun: PortalAccount }) {
  if (akun.tagihan.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm dark:bg-[#1e1e1e]">
        Belum ada tagihan.
      </section>
    );
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2 lg:gap-4">
      {akun.tagihan.map((item) => (
        <li
          key={item.noInvoice}
          className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#1e1e1e]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-[#c62828] dark:bg-red-950">
                <MdReceiptLong className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-medium capitalize">{item.periode}</p>
                <p className="text-xs text-slate-500">INV {item.noInvoice}</p>
                <p className="text-xs text-slate-500">Jatuh tempo {item.jatuhTempo}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.total)}</p>
              <p
                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  item.lunas
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                }`}
              >
                {item.lunas ? "Lunas" : "Belum bayar"}
              </p>
            </div>
          </div>
          {!item.lunas && akun.tripayEnabled ? (
            <TombolBayar pembayaranId={item.id} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Akun({ akun }: { akun: PortalAccount }) {
  return (
    <div className="grid gap-3 pb-2 lg:grid-cols-2 lg:items-start lg:gap-4">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#1e1e1e]">
        <Row label="Nama" value={akun.nama} />
        <Row label="Nomor HP" value={akun.nomor} />
        <Row label="Mitra" value={akun.mitra} />
        <Row label="No. layanan" value={akun.noLayanan} />
        <Row label="Username PPPoE" value={akun.pppName} />
        <Row label="Alamat" value={akun.alamat} />
      </section>
      <FormPinPelanggan pinSendiri={akun.pinSendiri} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-white/10">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function statusClass(status: string): string {
  if (status === "Isolir") return "bg-red-600";
  if (status === "Berhenti") return "bg-slate-500";
  return "bg-emerald-600";
}
