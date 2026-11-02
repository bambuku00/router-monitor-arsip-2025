"use client";

import { SessionLucia } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { hideMikrotikNavigation } from "@/lib/arsip-nav";
import { hasStaffMenuAccess } from "@/lib/staff-menu-access";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import { Router } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { FaChevronDown } from "react-icons/fa6";
import { BsGear, BsHddNetworkFill, BsTools } from "react-icons/bs";
import { GiServerRack } from "react-icons/gi";
import { HiBanknotes, HiOutlineCreditCard, HiOutlineLink, HiOutlineUsers } from "react-icons/hi2";
import { MdOutlineSignalWifi4Bar } from "react-icons/md";
import {
  TbBook,
  TbLayoutDashboard,
  TbLogout,
  TbReportMoney,
  TbSparkles,
  TbTicket,
} from "react-icons/tb";

export type NavLinksVariant =
  | "header"
  | "header-mobile"
  | "sidebar"
  | "sidebar-collapsed";

const NAV_ICON = "size-5 shrink-0";
const NAV_ICON_MOBILE = "size-6 shrink-0";

function navLinkClass(active: boolean, variant: NavLinksVariant) {
  if (variant === "sidebar-collapsed") {
    return cn(
      "flex w-full items-center justify-center rounded-lg p-2.5 transition",
      "focus-visible:outline-none focus-visible:ring focus-visible:ring-red-300 dark:focus-visible:ring-red-500/50",
      active
        ? "bg-red-600 text-white shadow-sm dark:bg-red-600 dark:text-white"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-theme-muted hover:text-slate-900 dark:hover:text-theme-fg"
    );
  }

  if (variant === "sidebar") {
    return cn(
      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
      "focus-visible:outline-none focus-visible:ring focus-visible:ring-red-300 dark:focus-visible:ring-red-500/50",
      active
        ? "bg-red-600 text-white shadow-sm dark:bg-red-600 dark:text-white"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-theme-muted hover:text-slate-900 dark:hover:text-theme-fg"
    );
  }

  const mobile = variant === "header-mobile";
  return cn(
    mobile
      ? "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium min-h-[4.25rem] text-center w-full"
      : "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium",
    "transition focus-visible:outline-none focus-visible:ring focus-visible:ring-red-300 dark:focus-visible:ring-red-500/50",
    active
      ? "bg-red-600 text-white shadow-sm dark:bg-red-600 dark:text-white"
      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-theme-muted hover:text-slate-900 dark:hover:text-theme-fg"
  );
}

function subLinkClass(active: boolean, popover = false) {
  return cn(
    "flex w-full items-center gap-2 rounded-lg text-sm transition",
    popover ? "p-2" : "px-3 py-2 pl-9",
    active
      ? popover
        ? "bg-slate-100 dark:bg-theme-muted font-medium"
        : "bg-slate-100 dark:bg-theme-muted font-medium text-slate-900 dark:text-theme-fg"
      : popover
        ? "hover:bg-slate-100 dark:hover:bg-theme-muted"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-theme-muted"
  );
}

function NavLabel({
  short,
  full,
  variant,
}: {
  short: string;
  full?: string;
  variant: NavLinksVariant;
}) {
  if (variant === "sidebar") {
    return <span className="truncate">{full ?? short}</span>;
  }
  if (variant === "sidebar-collapsed") {
    return null;
  }
  if (variant === "header-mobile") {
    return <span className="text-xs leading-tight">{full ?? short}</span>;
  }
  return (
    <>
      <span className="hidden sm:inline xl:hidden text-sm">{short}</span>
      <span className="hidden xl:inline text-sm">{full ?? short}</span>
    </>
  );
}

function SidebarSectionLabel({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        navLinkClass(active, "sidebar"),
        "cursor-default select-none"
      )}
      aria-hidden
    >
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

/** Hanya field yang dipakai di sini — password RouterOS tidak pernah dikirim ke client. */
type NavRouter = Pick<Router, "id" | "nama" | "host" | "port">;

type Props = {
  variant: NavLinksVariant;
  user: SessionLucia["user"] | undefined;
  routers: NavRouter[];
  tiketBaru?: number;
  onNavigate?: () => void;
};

export default function AppNavLinks({
  variant,
  user,
  routers,
  tiketBaru = 0,
  onNavigate,
}: Props) {
  const pathname = usePathname() ?? "";
  const isRouterPage = pathname.split("/").at(1) === "router";
  const navIcon = variant === "header-mobile" ? NAV_ICON_MOBILE : NAV_ICON;
  const isSidebarExpanded = variant === "sidebar";
  const isSidebarCollapsed = variant === "sidebar-collapsed";
  const isSidebarAny = isSidebarExpanded || isSidebarCollapsed;

  const isActive = useCallback(
    (key: string) => {
      switch (key) {
        case "dashboard":
          return pathname === "/dashboard";
        case "ppp":
          return pathname.includes("/ppp");
        case "tiket":
          return pathname === "/tiket" || pathname.startsWith("/tiket/");
        case "pembayaran":
          return (
            pathname.startsWith("/pembayaran/") &&
            !pathname.startsWith("/pembayaran/mitra")
          );
        case "pembayaran_mitra":
          return pathname.startsWith("/pembayaran/mitra");
        case "penagihan":
          return pathname === "/data-penagih" || pathname.startsWith("/data-penagih/");
        case "pembukuan":
          return pathname.startsWith("/pembukuan");
        case "mikrotik_tools":
          return pathname.startsWith("/tools/mikrotik");
        case "settings":
          return (
            pathname.startsWith("/settings") ||
            pathname.startsWith("/users") ||
            pathname.startsWith("/isolir") ||
            pathname.startsWith("/paket") ||
            pathname.startsWith("/billing/generate-log") ||
            pathname.startsWith("/log") ||
            pathname.startsWith("/petugas") ||
            pathname === "/routers" ||
            (isRouterPage && !pathname.includes("/ppp"))
          );
        case "settings_petugas":
          return pathname === "/petugas" || pathname.startsWith("/petugas/");
        case "settings_routers":
          return (
            pathname === "/routers" ||
            (isRouterPage && !pathname.includes("/ppp"))
          );
        case "settings_paket":
          return pathname.startsWith("/paket");
        case "settings_isolir_settings":
          return pathname.startsWith("/isolir/settings");
        case "settings_isolir_log":
          return pathname.startsWith("/isolir/log");
        case "activity_log":
          return pathname === "/log" || pathname.startsWith("/log/");
        case "settings_bank":
          return pathname === "/settings";
        case "settings_portal":
          return pathname.startsWith("/settings/portal");
        case "settings_tripay":
          return pathname.startsWith("/settings/tripay");
        case "settings_users":
          return pathname.startsWith("/users");
        case "settings_billing":
          return pathname.startsWith("/settings/billing");
        case "settings_invoice":
          return pathname.startsWith("/settings/invoice");
        case "billing_log":
          return pathname.startsWith("/billing/generate-log");
        case "pembaruan":
          return pathname.startsWith("/pembaruan");
        default:
          return false;
      }
    },
    [pathname, isRouterPage]
  );

  const hideMikrotikNav = hideMikrotikNavigation();

  const showPppoe =
    !hideMikrotikNav &&
    (user?.role === "Admin" ||
      user?.role === "Teknisi" ||
      user?.role === "Keuangan" ||
      user?.role === "Superadmin") &&
    user &&
    hasStaffMenuAccess(user, "pppoe");

  const showTiket =
    (user?.role === "Admin" ||
      user?.role === "Teknisi" ||
      user?.role === "Keuangan" ||
      user?.role === "Superadmin") &&
    user &&
    hasStaffMenuAccess(user, "pppoe");

  const showPembayaran =
    (user?.role === "Admin" ||
      user?.role === "Keuangan" ||
      user?.role === "Petugas" ||
      (user?.role === "Teknisi" && user?.parentId != null)) &&
    user &&
    hasStaffMenuAccess(user, "pembayaran");

  const showPenagihan =
    user &&
    (user.role === "Superadmin" || user.role === "Admin" || user.role === "Keuangan");

  const showPembukuan =
    user &&
    (user.role === "Superadmin" ||
      user.role === "Admin" ||
      user.role === "Keuangan" ||
      (user.role === "Teknisi" && user.parentId != null)) &&
    hasStaffMenuAccess(user, "pembukuan");

  const showIsolirSettings =
    user &&
    (user.role === "Superadmin" ||
      user.role === "Admin" ||
      user.role === "Keuangan" ||
      user.role === "Teknisi") &&
    hasStaffMenuAccess(user, "isolir_settings");

  const showIsolirLog =
    user &&
    (user.role === "Superadmin" ||
      user.role === "Admin" ||
      user.role === "Keuangan" ||
      user.role === "Teknisi") &&
    hasStaffMenuAccess(user, "isolir_log");

  const showDashboard =
    user && user.role !== "Petugas" && hasStaffMenuAccess(user, "dashboard");

  const showPembayaranMitra =
    user?.role === "Superadmin" &&
    hasStaffMenuAccess(user, "pembayaran_mitra");

  const showSettingsMenu =
    user &&
    user.role !== "Petugas" &&
    (hasStaffMenuAccess(user, "settings") ||
      (!hideMikrotikNav && hasStaffMenuAccess(user, "routers")) ||
      hasStaffMenuAccess(user, "paket") ||
      hasStaffMenuAccess(user, "isolir_settings") ||
      hasStaffMenuAccess(user, "isolir_log") ||
      showPenagihan ||
      user.role === "Superadmin" ||
      (user.role === "Admin" && hasStaffMenuAccess(user, "users")));

  const renderSettingsLinks = (popover: boolean) => {
    if (!user) return null;
    return (
      <>
          {!hideMikrotikNav && hasStaffMenuAccess(user, "routers") ? (
            <Link
              href="/routers"
              className={subLinkClass(isActive("settings_routers"), popover)}
              onClick={onNavigate}
            >
              <GiServerRack className="size-4 shrink-0 opacity-80" />
              <span>Router</span>
            </Link>
          ) : null}
          {hasStaffMenuAccess(user, "paket") ? (
            <Link
              href="/paket"
              className={subLinkClass(isActive("settings_paket"), popover)}
              onClick={onNavigate}
            >
              <MdOutlineSignalWifi4Bar className="size-4 shrink-0 opacity-80" />
              <span>Paket</span>
            </Link>
          ) : null}
          {hasStaffMenuAccess(user, "settings") ? (
            <Link
              href="/settings"
              className={subLinkClass(isActive("settings_bank"), popover)}
              onClick={onNavigate}
            >
              <HiBanknotes className="size-4 shrink-0 opacity-80" />
              <span>Bank</span>
            </Link>
          ) : null}
          {user.role === "Admin" || user.role === "Superadmin" ? (
            <Link
              href="/settings/portal"
              className={subLinkClass(isActive("settings_portal"), popover)}
              onClick={onNavigate}
            >
              <HiOutlineLink className="size-4 shrink-0 opacity-80" />
              <span>Portal Pelanggan</span>
            </Link>
          ) : null}
          {user.role === "Admin" || user.role === "Superadmin" ? (
            <Link
              href="/settings/tripay"
              className={subLinkClass(isActive("settings_tripay"), popover)}
              onClick={onNavigate}
            >
              <HiOutlineCreditCard className="size-4 shrink-0 opacity-80" />
              <span>Tripay</span>
            </Link>
          ) : null}
          {user.role === "Superadmin" ? (
            <Link
              href="/settings/billing"
              className={subLinkClass(isActive("settings_billing"), popover)}
              onClick={onNavigate}
            >
              <HiBanknotes className="size-4 shrink-0 opacity-80" />
              <span>Billing</span>
            </Link>
          ) : null}
          {user.role === "Admin" || user.role === "Superadmin" ? (
            <Link
              href="/settings/invoice"
              className={subLinkClass(isActive("settings_invoice"), popover)}
              onClick={onNavigate}
            >
              <TbReportMoney className="size-4 shrink-0 opacity-80" />
              <span>Invoice</span>
            </Link>
          ) : null}
          {showPenagihan ? (
            <Link
              href="/data-penagih"
              className={subLinkClass(isActive("penagihan"), popover)}
              onClick={onNavigate}
            >
              <TbReportMoney className="size-4 shrink-0 opacity-80" />
              <span>Data Penagih</span>
            </Link>
          ) : null}
          {showPenagihan ? (
            <Link
              href="/petugas"
              className={subLinkClass(isActive("settings_petugas"), popover)}
              onClick={onNavigate}
            >
              <TbReportMoney className="size-4 shrink-0 opacity-80" />
              <span>Kelola petugas</span>
            </Link>
          ) : null}
          {user.role === "Superadmin" ? (
            <Link
              href="/billing/generate-log"
              className={subLinkClass(isActive("billing_log"), popover)}
              onClick={onNavigate}
            >
              <TbReportMoney className="size-4 shrink-0 opacity-80" />
              <span>Log Generate Tagihan</span>
            </Link>
          ) : null}
          {showIsolirSettings ? (
            <Link
              href="/isolir/settings"
              className={subLinkClass(isActive("settings_isolir_settings"), popover)}
              onClick={onNavigate}
            >
              <TbReportMoney className="size-4 shrink-0 opacity-80" />
              <span>Isolir Otomatis</span>
            </Link>
          ) : null}
          {showIsolirLog ? (
            <Link
              href="/isolir/log"
              className={subLinkClass(isActive("settings_isolir_log"), popover)}
              onClick={onNavigate}
            >
              <TbReportMoney className="size-4 shrink-0 opacity-80" />
              <span>Log Auto Isolir</span>
            </Link>
          ) : null}
          {user.role === "Superadmin" || user.role === "Admin" ? (
            <Link
              href="/log"
              className={subLinkClass(isActive("activity_log"), popover)}
              onClick={onNavigate}
            >
              <TbReportMoney className="size-4 shrink-0 opacity-80" />
              <span>Log Aktivitas</span>
            </Link>
          ) : null}
          {(user.role === "Superadmin" || user.role === "Admin") &&
          hasStaffMenuAccess(user, "users") ? (
            <Link
              href="/users"
              className={subLinkClass(isActive("settings_users"), popover)}
              onClick={onNavigate}
            >
              <HiOutlineUsers className="size-4 shrink-0 opacity-80" />
              <span>User &amp; Client</span>
            </Link>
          ) : null}
      </>
    );
  };

  const pppLinks = useMemo(
    () =>
      routers.length === 0 ? (
        <p className="px-3 py-2 pl-9 text-xs text-slate-500 dark:text-slate-400">
          Belum ada router
        </p>
      ) : (
        routers.map((val) => (
          <Link
            key={val.id}
            href={`/router/${val.id}/ppp`}
            className={subLinkClass(pathname.includes(`/router/${val.id}/ppp`))}
            onClick={onNavigate}
          >
            <span className="min-w-0">
              <span className="block font-medium truncate">{val.nama}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                {val.host}
              </span>
            </span>
          </Link>
        ))
      ),
    [routers, pathname, onNavigate]
  );

  const pppPopoverLinks = useMemo(
    () =>
      routers.length === 0 ? (
        <p className="px-3 py-2 text-slate-500 dark:text-slate-400">
          Belum ada router
        </p>
      ) : (
        routers.map((val) => (
          <Link
            key={val.id}
            href={`/router/${val.id}/ppp`}
            className="block rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted"
            onClick={onNavigate}
          >
            <p className="font-semibold">{val.nama}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{val.host}</p>
          </Link>
        ))
      ),
    [routers, onNavigate]
  );

  const wrap = (content: React.ReactNode) => {
    if (isSidebarAny) {
      return (
        <div
          className={cn(
            "flex flex-col gap-0.5",
            isSidebarCollapsed ? "p-1" : "p-2"
          )}
        >
          {content}
        </div>
      );
    }
    return content;
  };

  return wrap(
    <>
      {showDashboard ? (
        <Link
          href="/dashboard"
          title="Dashboard"
          className={navLinkClass(isActive("dashboard"), variant)}
          onClick={onNavigate}
        >
          <TbLayoutDashboard className={navIcon} />
          <NavLabel short="Home" full="Dashboard" variant={variant} />
        </Link>
      ) : null}

      {showPembayaran && user ? (
        <Link
          href={`/pembayaran/${getOwnedResourcesUserId(user)}`}
          title="Pembayaran"
          className={navLinkClass(isActive("pembayaran"), variant)}
          onClick={onNavigate}
        >
          <HiBanknotes className={navIcon} />
          <NavLabel short="Bayar" full="Pembayaran" variant={variant} />
        </Link>
      ) : null}

      {showPppoe ? (
        isSidebarExpanded ? (
          <div>
            <SidebarSectionLabel
              active={isActive("ppp")}
              icon={<BsHddNetworkFill className={navIcon} />}
              label="PPPoE"
            />
            <div className="mt-0.5 flex flex-col gap-0.5">{pppLinks}</div>
          </div>
        ) : isSidebarCollapsed ? (
          <Popover className="relative w-full">
            <PopoverButton
              title="PPPoE"
              className={cn(
                navLinkClass(isActive("ppp"), "sidebar-collapsed"),
                "data-[open]:bg-red-600 data-[open]:text-white dark:data-[open]:bg-red-600 dark:data-[open]:text-white"
              )}
            >
              <BsHddNetworkFill className={navIcon} />
            </PopoverButton>
            <PopoverPanel
              transition
              anchor="right start"
              className="p-1 rounded-lg bg-slate-50 dark:bg-theme-elevated border border-slate-200 dark:border-theme-border text-sm/6 transition duration-150 ease-in-out [--anchor-gap:var(--spacing-2)] data-[closed]:-translate-x-1 data-[closed]:opacity-0 z-30 min-w-[12rem] max-h-64 overflow-y-auto"
            >
              {({ close }) => (
                <div
                  onClick={() => {
                    onNavigate?.();
                    close();
                  }}
                >
                  {pppPopoverLinks}
                </div>
              )}
            </PopoverPanel>
          </Popover>
        ) : (
          <Popover
            className={cn(
              "relative",
              variant === "header-mobile" && "w-full min-w-0"
            )}
          >
            <PopoverButton
              title="PPPoE"
              className={cn(
                navLinkClass(isActive("ppp"), variant),
                "data-[open]:bg-red-600 data-[open]:text-white dark:data-[open]:bg-red-600 dark:data-[open]:text-white",
                variant === "header-mobile" && "w-full"
              )}
            >
              <BsHddNetworkFill className={navIcon} />
              <NavLabel short="PPPoE" variant={variant} />
            </PopoverButton>
            <PopoverPanel
              transition
              anchor={variant === "header-mobile" ? "bottom" : "bottom start"}
              className="p-1 rounded-lg bg-slate-50 dark:bg-theme-elevated border border-slate-200 dark:border-theme-border text-sm/6 transition duration-150 ease-in-out [--anchor-gap:var(--spacing-2)] data-[closed]:-translate-y-1 data-[closed]:opacity-0 z-30 min-w-[12rem] max-h-64 overflow-y-auto"
            >
              {({ close }) => (
                <div
                  onClick={() => {
                    onNavigate?.();
                    close();
                  }}
                >
                  {pppPopoverLinks}
                </div>
              )}
            </PopoverPanel>
          </Popover>
        )
      ) : null}

      {showTiket ? (
        <Link
          href="/tiket"
          title={tiketBaru > 0 ? `Tiket pelanggan, ${tiketBaru} baru` : "Tiket pelanggan"}
          className={cn(navLinkClass(isActive("tiket"), variant), "relative")}
          onClick={onNavigate}
        >
          <span className="relative">
            <TbTicket className={navIcon} />
            {tiketBaru > 0 && (isSidebarCollapsed || variant === "header-mobile") ? (
              <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c62828] px-1 text-[10px] font-semibold leading-none text-white">
                {tiketBaru > 99 ? "99+" : tiketBaru}
              </span>
            ) : null}
          </span>
          <NavLabel short="Tiket" full="Tiket" variant={variant} />
          {tiketBaru > 0 && !isSidebarCollapsed && variant !== "header-mobile" ? (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold",
                isActive("tiket") ? "bg-white text-[#c62828]" : "bg-[#c62828] text-white"
              )}
            >
              {tiketBaru > 99 ? "99+" : tiketBaru}
            </span>
          ) : null}
        </Link>
      ) : null}

      {showPembayaranMitra && user ? (
        <Link
          href="/pembayaran/mitra"
          title="Pembayaran Mitra"
          className={navLinkClass(isActive("pembayaran_mitra"), variant)}
          onClick={onNavigate}
        >
          <TbReportMoney className={navIcon} />
          <NavLabel short="Mitra" full="Pembayaran Mitra" variant={variant} />
        </Link>
      ) : null}

      {showPembukuan ? (
        <Link
          href="/pembukuan"
          title="Pembukuan"
          className={navLinkClass(isActive("pembukuan"), variant)}
          onClick={onNavigate}
        >
          <TbBook className={navIcon} />
          <NavLabel short="Buku" full="Pembukuan" variant={variant} />
        </Link>
      ) : null}

      {!hideMikrotikNav &&
      user &&
      user.role !== "Petugas" &&
      hasStaffMenuAccess(user, "mikrotik_tools") ? (
        <Link
          href="/tools/mikrotik"
          title="Mikrotik Tools"
          className={navLinkClass(isActive("mikrotik_tools"), variant)}
          onClick={onNavigate}
        >
          <BsTools className={navIcon} />
          <NavLabel short="Mikrotik" full="Mikrotik Tools" variant={variant} />
        </Link>
      ) : null}

      {showSettingsMenu ? (
        isSidebarExpanded ? (
          <div>
            <SidebarSectionLabel
              active={isActive("settings")}
              icon={<BsGear className={navIcon} />}
              label="Pengaturan"
            />
            <div className="mt-0.5 flex flex-col gap-0.5">{renderSettingsLinks(false)}</div>
          </div>
        ) : isSidebarCollapsed ? (
          <Popover className="relative w-full">
            <PopoverButton
              title="Pengaturan"
              className={cn(
                navLinkClass(isActive("settings"), "sidebar-collapsed"),
                "data-[open]:bg-red-600 data-[open]:text-white dark:data-[open]:bg-red-600 dark:data-[open]:text-white"
              )}
            >
              <BsGear className={navIcon} />
            </PopoverButton>
            <PopoverPanel
              transition
              anchor="right start"
              className="p-1 rounded-lg bg-slate-50 dark:bg-theme-elevated border border-slate-200 dark:border-theme-border text-sm/6 transition duration-150 ease-in-out [--anchor-gap:var(--spacing-2)] data-[closed]:-translate-x-1 data-[closed]:opacity-0 z-30 min-w-[11rem] max-h-64 overflow-y-auto"
            >
              {({ close }) => (
                <div
                  className="flex flex-col"
                  onClick={() => {
                    onNavigate?.();
                    close();
                  }}
                >
                  {renderSettingsLinks(true)}
                </div>
              )}
            </PopoverPanel>
          </Popover>
        ) : (
          <Popover
            className={cn(
              "relative",
              variant === "header-mobile" && "w-full min-w-0"
            )}
          >
            <PopoverButton
              title="Pengaturan"
              className={cn(
                navLinkClass(isActive("settings"), variant),
                "group data-[open]:bg-red-600 data-[open]:text-white dark:data-[open]:bg-red-600 dark:data-[open]:text-white",
                variant === "header-mobile" && "w-full"
              )}
            >
              <BsGear className={navIcon} />
              <NavLabel short="Setelan" full="Pengaturan" variant={variant} />
              <FaChevronDown
                className={cn(
                  "size-3 shrink-0 opacity-80 transition-transform duration-200",
                  "group-data-[open]:rotate-180"
                )}
                aria-hidden
              />
            </PopoverButton>
            <PopoverPanel
              transition
              anchor={variant === "header-mobile" ? "bottom" : "bottom start"}
              className="p-1 rounded-lg bg-slate-50 dark:bg-theme-elevated border border-slate-200 dark:border-theme-border text-sm/6 transition duration-150 ease-in-out [--anchor-gap:var(--spacing-2)] data-[closed]:-translate-y-1 data-[closed]:opacity-0 z-30 min-w-[11rem]"
            >
              {({ close }) => (
                <div
                  className="flex flex-col"
                  onClick={() => {
                    onNavigate?.();
                    close();
                  }}
                >
                  {renderSettingsLinks(true)}
                </div>
              )}
            </PopoverPanel>
          </Popover>
        )
      ) : null}

      {user && (user.role === "Superadmin" || user.role === "Admin") ? (
        <Link
          href="/pembaruan"
          title="Pembaruan website — fitur & menu baru"
          aria-label="Pembaruan"
          className={navLinkClass(isActive("pembaruan"), variant)}
          onClick={onNavigate}
        >
          <TbSparkles className={navIcon} />
          {variant !== "header" && variant !== "sidebar-collapsed" ? (
            <NavLabel short="Baru" full="Pembaruan" variant={variant} />
          ) : null}
        </Link>
      ) : null}
    </>
  );
}
