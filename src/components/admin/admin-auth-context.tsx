"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { adminFetch } from "@/lib/admin-api-client";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "editor";
}

interface AdminAuthState {
  user: AdminUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ user: AdminUser }>("/api/admin/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pathname === "/admin/login") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no authenticated session expected on the login page
      setLoading(false);
      return;
    }
    load();
  }, [load, pathname]);

  const logout = useCallback(async () => {
    await adminFetch("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    window.location.href = "/admin/login";
  }, []);

  return (
    <AdminAuthContext.Provider value={{ user, loading, logout, refresh: load }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
