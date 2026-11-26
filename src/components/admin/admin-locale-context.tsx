"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AdminLocale = "en" | "fa";

interface AdminLocaleContextValue {
  locale: AdminLocale;
  dir: "ltr" | "rtl";
  isFa: boolean;
  setLocale: (next: AdminLocale) => void;
  toggleLocale: () => void;
}

const AdminLocaleContext = createContext<AdminLocaleContextValue>({
  locale: "en",
  dir: "ltr",
  isFa: false,
  setLocale: () => {},
  toggleLocale: () => {},
});

export function AdminLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("admin_dir");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync persisted admin direction preference on mount
    if (stored === "rtl") setLocaleState("fa");
    else if (stored === "ltr") setLocaleState("en");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const dir = locale === "fa" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
    window.localStorage.setItem("admin_dir", dir);
  }, [locale, hydrated]);

  const setLocale = useCallback((next: AdminLocale) => {
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === "en" ? "fa" : "en"));
  }, []);

  return (
    <AdminLocaleContext.Provider
      value={{
        locale,
        dir: locale === "fa" ? "rtl" : "ltr",
        isFa: locale === "fa",
        setLocale,
        toggleLocale,
      }}
    >
      {children}
    </AdminLocaleContext.Provider>
  );
}

export function useAdminLocale() {
  return useContext(AdminLocaleContext);
}
