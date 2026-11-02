"use client";

import {
  DEFAULT_NAV_LAYOUT,
  NavLayoutMode,
  readNavLayoutPreference,
  readSidebarCollapsedPreference,
  writeNavLayoutPreference,
  writeSidebarCollapsedPreference,
} from "@/lib/nav-layout";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type NavLayoutContextValue = {
  layout: NavLayoutMode;
  setLayout: (mode: NavLayoutMode) => void;
  toggleLayout: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  mounted: boolean;
};

const NavLayoutContext = createContext<NavLayoutContextValue | null>(null);

export function NavLayoutProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayoutState] = useState<NavLayoutMode>(DEFAULT_NAV_LAYOUT);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLayoutState(readNavLayoutPreference());
    setSidebarCollapsedState(readSidebarCollapsedPreference());
    setMounted(true);
  }, []);

  const setLayout = useCallback((mode: NavLayoutMode) => {
    setLayoutState(mode);
    writeNavLayoutPreference(mode);
  }, []);

  const toggleLayout = useCallback(() => {
    setLayoutState((prev) => {
      const next = prev === "header" ? "sidebar" : "header";
      writeNavLayoutPreference(next);
      return next;
    });
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    writeSidebarCollapsedPreference(collapsed);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      writeSidebarCollapsedPreference(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      layout,
      setLayout,
      toggleLayout,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      mounted,
    }),
    [
      layout,
      setLayout,
      toggleLayout,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      mounted,
    ]
  );

  return (
    <NavLayoutContext.Provider value={value}>{children}</NavLayoutContext.Provider>
  );
}

export function useNavLayout() {
  const ctx = useContext(NavLayoutContext);
  if (!ctx) {
    throw new Error("useNavLayout must be used within NavLayoutProvider");
  }
  return ctx;
}
