"use client";

import AppNavLinks from "@/components/app-nav-links";
import DialogUser from "@/components/header/dialog-user";
import LayoutToggle from "@/components/layout-toggle";
import SidebarResizeHandle from "@/components/sidebar-resize-handle";
import { useNavLayout } from "@/components/nav-layout-provider";
import ThemeToggle from "@/components/theme-toggle";
import { Button } from "@/components/button";
import { SessionLucia } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Transition, TransitionChild } from "@headlessui/react";
import { Router } from "@prisma/client";
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
import { GiServerRack } from "react-icons/gi";
import { HiUser } from "react-icons/hi2";
import { TbLayoutDashboard, TbLogout, TbMenu2, TbUserSquareRounded, TbX } from "react-icons/tb";

/** Hanya field yang dipakai di sini — password RouterOS tidak pernah dikirim ke client. */
type NavRouter = Pick<Router, "id" | "nama" | "host" | "port">;

type Props = {
  routers?: NavRouter[];
  session?: SessionLucia;
  tiketBaru?: number;
  children: React.ReactNode;
};

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

export default function AppShell({
  routers: serverRouters,
  session: serverSession,
  tiketBaru = 0,
  children,
}: Props) {
  const { refresh, push } = useRouter();
  const pathname = usePathname();
  const { layout, mounted, sidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapsed } =
    useNavLayout();
  const isSidebarLayout = mounted && layout === "sidebar";
  const sidebarNarrow = isSidebarLayout && sidebarCollapsed;

  const isRouterPage = useMemo(
    () => pathname?.split("/")?.at(1) === "router",
    [pathname]
  );

  const [auth, setAuth] = useState<SessionLucia | undefined>(serverSession);
  const [mutatingLogout, setMutatingLogout] = useState(false);

  const logoutHandler = useCallback(async () => {
    setMutatingLogout(true);
    try {
      const resp = await fetch("/api/auth/logout", { method: "POST" });
      const json = await resp.json();
      if (json?.error) throw new Error(json.error);
      toast.success(json?.message || "Berhasil keluar");
      refresh();
      push(auth?.user?.role === "Petugas" ? "/login/petugas" : "/login");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setMutatingLogout(false);
    }
  }, [auth?.user?.role, refresh, push]);

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
    if (!serverSession) loadSession();
    else setAuth(serverSession);
  }, [serverSession, loadSession]);

  const [routers, setRouters] = useState<NavRouter[]>(serverRouters || []);
  useEffect(() => {
    if (serverRouters) setRouters(serverRouters);
  }, [serverRouters]);

  const loadRouters = async () => {
    try {
      const resp = await fetch("/api/router");
      const json = await resp.json();
      if (!resp.ok) throw new Error(json || "Terjadi kesalahan pada server");
      setRouters(json.data);
    } catch (err) {
      console.error(err as Error);
    }
  };

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

  const initialized = useRef(false);
  useLayoutEffect(() => {
    if (!initialized.current) {
      if (!serverSession) loadSession();
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync session once on mount
  }, []);

  const shellRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
    setSidebarMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen && !sidebarMobileOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (shellRef.current?.contains(ev.target as Node)) return;
      if (dialogRef.current?.contains(ev.target as Node)) return;
      setMobileNavOpen(false);
      setSidebarMobileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileNavOpen, sidebarMobileOpen]);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
    setSidebarMobileOpen(false);
  }, []);

  const user = auth?.user;

  const activeRouter = useMemo(
    () =>
      routers.find(
        (val) => val.id === parseInt(pathname.split("/").at(2) || "", 10)
      ),
    [routers, pathname]
  );

  const toolbarActions = (
    <div className="flex items-center justify-end gap-1 shrink-0">
      <LayoutToggle />
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
  );

  const routerInfo = (
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
  );

  const sidebarNav = (
    <AppNavLinks
      variant={sidebarNarrow ? "sidebar-collapsed" : "sidebar"}
      user={user}
      routers={routers}
      tiketBaru={tiketBaru}
      onNavigate={closeMobileNav}
    />
  );

  const headerNavMobile = (
    <AppNavLinks
      variant="header-mobile"
      user={user}
      routers={routers}
      tiketBaru={tiketBaru}
      onNavigate={closeMobileNav}
    />
  );

  const headerNavDesktop = (
    <AppNavLinks variant="header" user={user} routers={routers} tiketBaru={tiketBaru} />
  );

  if (user?.role === "Petugas") {
    return (
      <div
        className="min-h-dvh bg-[#e6e9ee] text-slate-900 dark:bg-[#0e0e10] dark:text-slate-100"
        ref={shellRef}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-theme-border dark:bg-theme-card/95">
          <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">Penagihan</p>
              <p className="truncate text-xs text-slate-500 dark:text-theme-fg-muted">
                {user.nama}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle showLabel />
              <button
                type="button"
                className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-red-600 disabled:opacity-60 dark:text-red-400"
                onClick={() => void logoutHandler()}
                disabled={mutatingLogout}
              >
                Keluar
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-lg px-3 py-4 pb-10">{children}</main>
      </div>
    );
  }

  if (isSidebarLayout) {
    return (
      <div
        className="min-h-screen text-slate-700 dark:text-theme-fg bg-white dark:bg-theme-bg"
        ref={shellRef}
      >
        {/* Mobile sidebar drawer */}
        <Transition show={sidebarMobileOpen}>
          <div className="md:hidden fixed inset-0 z-40">
            <TransitionChild
              enter="transition-opacity ease-out duration-200"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <button
                type="button"
                className="absolute inset-0 bg-slate-950/40"
                aria-label="Tutup menu"
                onClick={() => setSidebarMobileOpen(false)}
              />
            </TransitionChild>
            <TransitionChild
              enter="transition ease-out duration-200"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <aside className="absolute top-0 bottom-0 left-0 w-[min(18rem,85vw)] bg-white dark:bg-theme-card border-r border-slate-200 dark:border-theme-border shadow-xl flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-theme-border/80">
                  <p className="text-sm font-semibold">Menu</p>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-theme-muted"
                    onClick={() => setSidebarMobileOpen(false)}
                    aria-label="Tutup menu"
                  >
                    <TbX className="size-5" />
                  </button>
                </div>
                <nav
                  className="flex-1 overflow-y-auto py-1 flex flex-col"
                  aria-label="Navigasi mobile sidebar"
                >
                  <div className="flex-1">{sidebarNav}</div>
                  <div className="p-2 border-t border-slate-200/80 dark:border-theme-border/80">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      onClick={() => {
                        closeMobileNav();
                        void logoutHandler();
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </nav>
              </aside>
            </TransitionChild>
          </div>
        </Transition>

        <div className="flex min-h-screen flex-col md:flex-row md:items-stretch md:gap-3 md:px-6 md:py-1">
          <aside
            className={cn(
              "hidden md:flex shrink-0 sticky top-1 self-start max-h-[calc(100dvh-0.5rem)] flex-col z-20 relative",
              "rounded-lg border border-slate-200 dark:border-theme-border",
              "bg-white dark:bg-theme-card shadow-xl shadow-slate-950/5 dark:shadow-black/20",
              "transition-[width] duration-200 ease-out overflow-visible",
              sidebarNarrow ? "w-[4.25rem]" : "w-60"
            )}
          >
            <SidebarResizeHandle
              collapsed={sidebarNarrow}
              onCollapsedChange={setSidebarCollapsed}
              onToggle={toggleSidebarCollapsed}
            />
            <div
              className={cn(
                "border-b border-slate-200/80 dark:border-theme-border/80",
                sidebarNarrow ? "px-2 py-3 flex justify-center" : "px-4 py-3"
              )}
            >
              {sidebarNarrow ? (
                <span title="Router Monitor" className="inline-flex">
                  <TbLayoutDashboard className="size-6 text-red-600 dark:text-red-400 shrink-0" />
                </span>
              ) : (
                <>
                  <p className="text-sm font-semibold truncate">Router Monitor</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user?.nama}
                  </p>
                </>
              )}
            </div>
            <nav
              className="flex-1 overflow-y-auto overflow-x-hidden py-1 flex flex-col min-h-0"
              aria-label="Navigasi sidebar"
            >
              <div className="flex-1">{sidebarNav}</div>
              <div className="p-2 border-t border-slate-200/80 dark:border-theme-border/80">
                <button
                  type="button"
                  title="Logout"
                  className={cn(
                    "flex items-center justify-center rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition",
                    sidebarNarrow ? "w-full p-2.5" : "w-full gap-2 px-3 py-2"
                  )}
                  onClick={() => void logoutHandler()}
                >
                  <TbLogout className="size-5 shrink-0" />
                  {!sidebarNarrow ? <span>Logout</span> : null}
                </button>
              </div>
            </nav>
          </aside>

          <div className="flex flex-col flex-1 min-w-0">
            <header
              className={cn(
                "z-10 shrink-0 max-md:fixed max-md:top-1 max-md:left-1 max-md:right-1",
                "md:sticky md:top-1",
                "before:border before:absolute before:rounded-lg before:inset-0",
                "before:shadow-xl before:shadow-slate-950/5 before:bg-white dark:before:bg-theme-card",
                "dark:before:border-theme-border dark:before:shadow-black/20"
              )}
            >
              <div className="relative flex items-center gap-2 px-2 sm:px-4 min-h-14 md:min-h-16">
                <button
                  type="button"
                  className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-theme-muted shrink-0"
                  onClick={() => setSidebarMobileOpen(true)}
                  aria-label="Buka menu"
                >
                  <TbMenu2 className="size-6" />
                </button>
                <div className="hidden md:flex items-center min-w-0 flex-1">
                  {routerInfo}
                </div>
                <div className="md:hidden flex-1 min-w-0 px-1">
                  {isRouterPage && activeRouter ? (
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate text-center">
                      {activeRouter.nama}
                    </p>
                  ) : null}
                </div>
                {toolbarActions}
              </div>
            </header>

            <main className="flex-1 min-h-0 pt-[4rem] md:pt-3 px-2 md:px-0 pb-8">
              {children}
            </main>
          </div>
        </div>

        <DialogUser
          initialFocusRef={shellRef}
          ref={dialogRef}
          show={showDialog}
          setShow={setShowDialog}
          user={auth?.user}
        />
      </div>
    );
  }

  return (
    <div ref={shellRef}>
      <header
        className={cn(
          "fixed top-1 right-0 left-0 mx-1 sm:mx-2 md:mx-6 before:border before:absolute before:rounded-lg before:inset-0",
          "before:shadow-xl before:shadow-slate-950/5 before:bg-white dark:before:bg-theme-card",
          "dark:before:border-theme-border dark:before:shadow-black/20 z-10"
        )}
      >
        <div className="relative">
          <div className="flex md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 sm:px-4 min-h-14 md:min-h-16">
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

            <div className="hidden md:flex items-center min-w-0 max-w-[9rem] lg:max-w-[11rem]">
              {routerInfo}
            </div>

            <div className="md:hidden flex-1 min-w-0 px-1">
              {isRouterPage && activeRouter ? (
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate text-center">
                  {activeRouter.nama}
                </p>
              ) : null}
            </div>

            <nav
              className="hidden md:flex items-center justify-center flex-nowrap gap-1 min-w-0"
              aria-label="Navigasi utama"
            >
              {headerNavDesktop}
            </nav>

            {toolbarActions}
          </div>

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
              {headerNavMobile}
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

      <main className="min-h-screen pt-[3.75rem] md:pt-24 px-2 md:px-8 pb-8">
        {children}
      </main>

      <DialogUser
        initialFocusRef={shellRef}
        ref={dialogRef}
        show={showDialog}
        setShow={setShowDialog}
        user={auth?.user}
      />
    </div>
  );
}
