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
  Transition,
} from "@headlessui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { FaChevronDown } from "react-icons/fa6";
import { BsGear, BsHddNetworkFill, BsTools } from "react-icons/bs";
import { GiServerRack } from "react-icons/gi";
import { HiBanknotes, HiOutlineCreditCard, HiOutlineLink, HiOutlineUsers, HiUser } from "react-icons/hi2";
import { MdOutlineSignalWifi4Bar } from "react-icons/md";
import {
  TbBook,
  TbLayoutDashboard,
  TbMenu2,
  TbReportMoney,
  TbSparkles,
  TbUserSquareRounded,
  TbX,
} from "react-icons/tb";
import { Button } from "../button";
import DialogUser from "./dialog-user";
import ThemeToggle from "../theme-toggle";
import { Router } from "@prisma/client";

type Props = {
  routers?: Router[];
  session?: SessionLucia;
};

const NAV_ICON = "size-5 shrink-0";
const NAV_ICON_MOBILE = "size-6 shrink-0";

const navLinkClass = (active: boolean, mobile = false) =>
  cn(
    mobile
      ? "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium min-h-[4.25rem] text-center"
      : "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium",
    "transition focus-visible:outline-none focus-visible:ring focus-visible:ring-red-300 dark:focus-visible:ring-red-500/50",
    active
      ? "bg-red-600 text-white shadow-sm dark:bg-red-600 dark:text-white"
      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-theme-muted hover:text-slate-900 dark:hover:text-theme-fg"
  );

function NavLabel({
  short,
  full,
  mobile = false,
}: {
  short: string;
  full?: string;
  mobile?: boolean;
}) {
  if (mobile) {
    return <span className="text-xs leading-tight">{full ?? short}</span>;
  }
  return (
    <>
      <span className="hidden sm:inline xl:hidden text-sm">{short}</span>
      {full ? (
        <span className="hidden xl:inline text-sm">{full}</span>
      ) : (
        <span className="hidden xl:inline text-sm">{short}</span>
      )}
    </>
  );
}

export default function Header({
  routers: serverRouters,
  session: serverSession,
}: Props) {
  const { refresh, push } = useRouter();
  const pathname = usePathname();
  const isRouterPage = useMemo(
    () => pathname?.split("/")?.at(1) === "router",
    [pathname]
  );

  const [auth, setAuth] = useState<SessionLucia | undefined>(serverSession);
  const [mutatingLogout, setMutatingLogout] = useState<boolean>(false);
  const logoutHandler = useCallback(async () => {
    setMutatingLogout(true);
    try {
      const resp = await fetch("/api/auth/logout", {
        method: "POST",
      });
      const json = await resp.json();
      if (json?.error) throw new Error(json.error);
      toast.success(json?.message || "Berhasil keluar");
      refresh();
      push("/login");
    } catch (err) {
      const error = err as Error;
      toast.error(error.message);
    } finally {
      setMutatingLogout(false);
    }
  }, [refresh, push]);

  const loadSession = useCallback(async () => {
    try {
      const resp = await fetch("/api/auth/session");
      const json = await resp.json();
      if (!resp.ok) throw new Error(json || "Terjadi kesalahan pada server");
      setAuth(json.data);
    } catch (err) {
      const error = err as Error;
      if (error.message !== "Unauthorized") console.error(error);
      await logoutHandler();
    }
  }, [logoutHandler]);

  useEffect(() => {
    if (!serverSession) {
      loadSession();
    } else {
      setAuth(serverSession);
    }
  }, [serverSession, loadSession]);

  useEffect(() => {
    if (
      !serverRouters &&
      auth?.user?.id &&
      (auth?.user?.role === "Admin" ||
        auth.user.role === "Superadmin" ||
        auth.user.role === "Client" ||
        auth.user.role === "Keuangan" ||
        auth.user.role === "Teknisi")
    ) {
      loadRouters();
    }
  }, [auth, serverRouters]);

  const [routers, setRouters] = useState<Router[]>(serverRouters || []);
  useEffect(() => {
    if (serverRouters) {
      setRouters(serverRouters);
    }
  }, [serverRouters]);

  const loadRouters = async () => {
    try {
      const resp = await fetch("/api/router");
      const json = await resp.json();
      if (!resp.ok) throw new Error(json || "Terjadi kesalahan pada server");
      setRouters(json.data);
    } catch (err) {
      const error = err as Error;
      console.error(error);
    }
  };

  const initialized = useRef<boolean>(false);
  useLayoutEffect(() => {
    if (!initialized.current) {
      if (!serverSession) loadSession();
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to sync session
  }, []);

  const headerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (headerRef.current?.contains(ev.target as Node)) return;
      if (dialogRef.current?.contains(ev.target as Node)) return;
      setMobileNavOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileNavOpen]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const navIcon = (mobile: boolean) => (mobile ? NAV_ICON_MOBILE : NAV_ICON);

  const activeRouter = useMemo(
    () =>
      routers.find(
        (val) => val.id === parseInt(pathname.split("/").at(2) || "", 10)
      ),
    [routers, pathname]
  );

  const isActive = useCallback(
    (key: string) => {
      if (!pathname) return false;
      switch (key) {
        case "dashboard":
          return pathname === "/dashboard";
        case "routers":
          return pathname === "/routers" || (isRouterPage && !pathname.includes("/ppp"));
        case "ppp":
          return pathname.includes("/ppp");
        case "paket":
          return pathname.startsWith("/paket");
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
        case "auto_isolir":
          return pathname.startsWith("/isolir");
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
          return pathname === "/routers" || (isRouterPage && !pathname.includes("/ppp"));
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

  const user = auth?.user;
  const hideMikrotikNav = hideMikrotikNavigation();

  const showPppoe =
    !hideMikrotikNav &&
    (user?.role === "Admin" ||
      user?.role === "Teknisi" ||
      user?.role === "Keuangan") &&
    user &&
    hasStaffMenuAccess(user, "routers");

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

  const renderNavLinks = (mobile: boolean) => (
    <>
      {showDashboard ? (
        <Link
          href="/dashboard"
          title="Dashboard"
          className={navLinkClass(isActive("dashboard"), mobile)}
          onClick={mobile ? closeMobileNav : undefined}
        >
          <TbLayoutDashboard className={navIcon(mobile)} />
          <NavLabel short="Home" full="Dashboard" mobile={mobile} />
        </Link>
      ) : null}

      {showPembayaran && user ? (
        <Link
          href={`/pembayaran/${getOwnedResourcesUserId(user)}`}
          title="Pembayaran"
          className={navLinkClass(isActive("pembayaran"), mobile)}
          onClick={mobile ? closeMobileNav : undefined}
        >
          <HiBanknotes className={navIcon(mobile)} />
          <NavLabel short="Bayar" full="Pembayaran" mobile={mobile} />
        </Link>
      ) : null}

      {showPppoe ? (
        <Popover className={cn("relative", mobile && "w-full min-w-0")}>
          <PopoverButton
            title="PPPoE"
            className={cn(
              navLinkClass(isActive("ppp"), mobile),
              "data-[open]:bg-red-600 data-[open]:text-white dark:data-[open]:bg-red-600 dark:data-[open]:text-white",
              mobile && "w-full"
            )}
          >
            <BsHddNetworkFill className={navIcon(mobile)} />
            <NavLabel short="PPPoE" mobile={mobile} />
          </PopoverButton>
          <PopoverPanel
            transition
            anchor={mobile ? "bottom" : "bottom start"}
            className="p-1 rounded-lg bg-slate-50 dark:bg-theme-elevated border border-slate-200 dark:border-theme-border text-sm/6 transition duration-150 ease-in-out [--anchor-gap:var(--spacing-2)] data-[closed]:-translate-y-1 data-[closed]:opacity-0 z-30 min-w-[12rem] max-h-64 overflow-y-auto"
          >
            {({ close }) => (
              <>
                {routers.length === 0 ? (
                  <p className="px-3 py-2 text-slate-500 dark:text-slate-400">
                    Belum ada router
                  </p>
                ) : (
                  routers.map((val) => (
                    <Link
                      key={val.id}
                      href={`/router/${val.id}/ppp`}
                      className="block rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted"
                      onClick={() => {
                        closeMobileNav();
                        close();
                      }}
                    >
                      <p className="font-semibold">{val.nama}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        {val.host}
                      </p>
                    </Link>
                  ))
                )}
              </>
            )}
          </PopoverPanel>
        </Popover>
      ) : null}

      {showPembayaranMitra && user ? (
        <Link
          href="/pembayaran/mitra"
          title="Pembayaran Mitra"
          className={navLinkClass(isActive("pembayaran_mitra"), mobile)}
          onClick={mobile ? closeMobileNav : undefined}
        >
          <TbReportMoney className={navIcon(mobile)} />
          <NavLabel short="Mitra" full="Pembayaran Mitra" mobile={mobile} />
        </Link>
      ) : null}

      {showPembukuan ? (
        <Link
          href="/pembukuan"
          title="Pembukuan"
          className={navLinkClass(isActive("pembukuan"), mobile)}
          onClick={mobile ? closeMobileNav : undefined}
        >
          <TbBook className={navIcon(mobile)} />
          <NavLabel short="Buku" full="Pembukuan" mobile={mobile} />
        </Link>
      ) : null}

      {!hideMikrotikNav &&
      user &&
      user.role !== "Petugas" &&
      hasStaffMenuAccess(user, "mikrotik_tools") ? (
        <Link
          href="/tools/mikrotik"
          title="Mikrotik Tools"
          className={navLinkClass(isActive("mikrotik_tools"), mobile)}
          onClick={mobile ? closeMobileNav : undefined}
        >
          <BsTools className={navIcon(mobile)} />
          <NavLabel short="Mikrotik" full="Mikrotik Tools" mobile={mobile} />
        </Link>
      ) : null}

      {showSettingsMenu ? (
        <Popover className={cn("relative", mobile && "w-full min-w-0")}>
          <PopoverButton
            title="Pengaturan"
            className={cn(
              navLinkClass(isActive("settings"), mobile),
              "group data-[open]:bg-red-600 data-[open]:text-white dark:data-[open]:bg-red-600 dark:data-[open]:text-white",
              mobile && "w-full"
            )}
          >
            <BsGear className={navIcon(mobile)} />
            <NavLabel short="Setelan" full="Pengaturan" mobile={mobile} />
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
            anchor={mobile ? "bottom" : "bottom start"}
            className="p-1 rounded-lg bg-slate-50 dark:bg-theme-elevated border border-slate-200 dark:border-theme-border text-sm/6 transition duration-150 ease-in-out [--anchor-gap:var(--spacing-2)] data-[closed]:-translate-y-1 data-[closed]:opacity-0 z-30 min-w-[11rem]"
          >
            {({ close }) => (
              <>
                {!hideMikrotikNav &&
                user &&
                hasStaffMenuAccess(user, "routers") ? (
                  <Link
                    href="/routers"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_routers") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <GiServerRack className="size-4 shrink-0 opacity-80" />
                    <span>Router</span>
                  </Link>
                ) : null}
                {user && hasStaffMenuAccess(user, "paket") ? (
                  <Link
                    href="/paket"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_paket") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <MdOutlineSignalWifi4Bar className="size-4 shrink-0 opacity-80" />
                    <span>Paket</span>
                  </Link>
                ) : null}
                {user && hasStaffMenuAccess(user, "settings") ? (
                  <Link
                    href="/settings"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_bank") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <HiBanknotes className="size-4 shrink-0 opacity-80" />
                    <span>Bank</span>
                  </Link>
                ) : null}
                {user?.role === "Admin" || user?.role === "Superadmin" ? (
                  <Link
                    href="/settings/portal"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_portal") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <HiOutlineLink className="size-4 shrink-0 opacity-80" />
                    <span>Portal Pelanggan</span>
                  </Link>
                ) : null}
                {user?.role === "Admin" || user?.role === "Superadmin" ? (
                  <Link
                    href="/settings/tripay"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_tripay") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <HiOutlineCreditCard className="size-4 shrink-0 opacity-80" />
                    <span>Tripay</span>
                  </Link>
                ) : null}
                {user?.role === "Superadmin" ? (
                  <Link
                    href="/settings/billing"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_billing") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <HiBanknotes className="size-4 shrink-0 opacity-80" />
                    <span>Billing</span>
                  </Link>
                ) : null}
                {showPenagihan ? (
                  <Link
                    href="/data-penagih"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("penagihan") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <TbReportMoney className="size-4 shrink-0 opacity-80" />
                    <span>Data Penagih</span>
                  </Link>
                ) : null}
                {showPenagihan ? (
                  <Link
                    href="/petugas"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_petugas") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <TbReportMoney className="size-4 shrink-0 opacity-80" />
                    <span>Kelola petugas</span>
                  </Link>
                ) : null}
                {user?.role === "Superadmin" ? (
                  <Link
                    href="/billing/generate-log"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("billing_log") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <TbReportMoney className="size-4 shrink-0 opacity-80" />
                    <span>Log Generate Tagihan</span>
                  </Link>
                ) : null}
                {showIsolirSettings ? (
                  <Link
                    href="/isolir/settings"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_isolir_settings") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <TbReportMoney className="size-4 shrink-0 opacity-80" />
                    <span>Isolir Otomatis</span>
                  </Link>
                ) : null}
                {showIsolirLog ? (
                  <Link
                    href="/isolir/log"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_isolir_log") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <TbReportMoney className="size-4 shrink-0 opacity-80" />
                    <span>Log Auto Isolir</span>
                  </Link>
                ) : null}
                {user &&
                (user.role === "Superadmin" || user.role === "Admin") ? (
                  <Link
                    href="/log"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("activity_log") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <TbReportMoney className="size-4 shrink-0 opacity-80" />
                    <span>Log Aktivitas</span>
                  </Link>
                ) : null}
                {user &&
                (user.role === "Superadmin" || user.role === "Admin") &&
                hasStaffMenuAccess(user, "users") ? (
                  <Link
                    href="/users"
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-theme-muted",
                      isActive("settings_users") &&
                        "bg-slate-100 dark:bg-theme-muted font-medium"
                    )}
                    onClick={() => {
                      closeMobileNav();
                      close();
                    }}
                  >
                    <HiOutlineUsers className="size-4 shrink-0 opacity-80" />
                    <span>User &amp; Client</span>
                  </Link>
                ) : null}
              </>
            )}
          </PopoverPanel>
        </Popover>
      ) : null}

      {user &&
      (user.role === "Superadmin" || user.role === "Admin") ? (
        <Link
          href="/pembaruan"
          title="Pembaruan website — fitur & menu baru"
          aria-label="Pembaruan"
          className={navLinkClass(isActive("pembaruan"), mobile)}
          onClick={mobile ? closeMobileNav : undefined}
        >
          <TbSparkles className={navIcon(mobile)} />
        </Link>
      ) : null}
    </>
  );

  return (
    <>
      <header
        className={cn(
          "fixed top-1 right-0 left-0 mx-1 sm:mx-2 md:mx-6 before:border before:absolute before:rounded-lg before:inset-0",
          "before:shadow-xl before:shadow-slate-950/5 before:bg-white dark:before:bg-theme-card",
          "dark:before:border-theme-border dark:before:shadow-black/20 z-10"
        )}
      >
        <div className="relative" ref={headerRef}>
          {/* Bar utama */}
          <div className="flex md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 sm:px-4 min-h-14 md:min-h-16">
            {/* HP: tombol menu */}
          <button
            type="button"
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-theme-muted focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-300 shrink-0"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? "Tutup menu" : "Buka menu"}
            >
              {mobileNavOpen ? (
                <TbX className="size-6" />
              ) : (
                <TbMenu2 className="size-6" />
              )}
            </button>

            {/* Desktop: info router */}
            <div className="hidden md:flex items-center min-w-0 max-w-[9rem] lg:max-w-[11rem]">
              <Transition
                appear
                show={isRouterPage && routers.length > 0}
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <GiServerRack className="size-3.5 shrink-0" />
                  <p className="text-[10px] lg:text-xs truncate">
                    {activeRouter
                      ? `${activeRouter.nama} ${activeRouter.host}:${activeRouter.port}`
                      : ""}
                  </p>
                </div>
              </Transition>
            </div>

            {/* HP: judul router aktif di tengah bar */}
            <div className="md:hidden flex-1 min-w-0 px-1">
              {isRouterPage && activeRouter ? (
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate text-center">
                  {activeRouter.nama}
                </p>
              ) : null}
            </div>

            {/* Desktop: menu horizontal */}
            <nav
              className="hidden md:flex items-center justify-center flex-nowrap gap-1 min-w-0"
              aria-label="Navigasi utama"
            >
              {renderNavLinks(false)}
            </nav>

            {/* Kanan: tema, profil, logout */}
            <div className="flex items-center justify-end gap-1 shrink-0">
              <ThemeToggle className="!p-1.5 md:!p-2" />
                          <button
                            type="button"
                className="hidden xl:inline-flex items-center gap-1 min-w-0 rounded-lg px-1.5 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-theme-muted focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-300 transition"
                onClick={() => setShowDialog(true)}
              >
                <HiUser className="text-slate-600 dark:text-slate-400 size-4 shrink-0" />
                <span className="truncate max-w-[6rem]">{user?.nama}</span>
                          </button>
                        <button
                          type="button"
                className="xl:hidden p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-theme-muted focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-300"
                onClick={() => setShowDialog(true)}
                aria-label="Profil pengguna"
              >
                <TbUserSquareRounded className="size-5 text-slate-700 dark:text-slate-200" />
                        </button>
                        <Button
                          loading={mutatingLogout}
                          color="red100"
                className="hidden md:inline-flex rounded-full px-2.5 py-1 text-xs font-medium enabled:hover:bg-red-600 enabled:hover:text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-red-300 transition"
                          onClick={logoutHandler}
                        >
                          Logout
                        </Button>
                      </div>
                    </div>

          {/* HP: panel menu */}
          <Transition
            show={mobileNavOpen}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-1"
          >
            <nav
              className="md:hidden border-t border-slate-200/80 dark:border-theme-border/80 px-3 py-3 grid grid-cols-2 gap-2 max-h-[min(70vh,24rem)] overflow-y-auto"
              aria-label="Navigasi mobile"
            >
              {renderNavLinks(true)}
              <button
                type="button"
                className={cn(
                  navLinkClass(false, true),
                  "col-span-2 flex-row justify-center gap-2 min-h-0 py-3 text-red-600 dark:text-red-400"
                )}
                onClick={() => {
                  closeMobileNav();
                  void logoutHandler();
                }}
              >
                Logout
              </button>
          </nav>
          </Transition>
        </div>
      </header>
      <DialogUser
        initialFocusRef={headerRef}
        ref={dialogRef}
        show={showDialog}
        setShow={setShowDialog}
        user={auth?.user}
      />
    </>
  );
}
