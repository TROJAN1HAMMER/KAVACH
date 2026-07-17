import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "../lib/api/auth";
import { onUnauthorized, tokenStorage } from "../lib/api/client";
import type { User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // "loading" only when there's actually a token to verify against
  // /auth/me — with no token, there's nothing async to wait on, so the
  // initial state is derived synchronously instead of via an effect.
  const [status, setStatus] = useState<AuthContextValue["status"]>(() =>
    tokenStorage.getAccessToken() ? "loading" : "unauthenticated",
  );

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
  }, [logout]);

  useEffect(() => {
    if (!tokenStorage.getAccessToken()) return;
    authApi
      .me()
      .then((me) => {
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        tokenStorage.clear();
        setStatus("unauthenticated");
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password);
    const me = await authApi.me();
    setUser(me);
    setStatus("authenticated");
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
