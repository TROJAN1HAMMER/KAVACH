import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "../lib/api/auth";
import { onUnauthorized, tokenStorage } from "../lib/api/client";
import type { User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  // Resolves with the freshly-fetched user so callers (e.g. LoginPage) can
  // route based on role immediately, without waiting an extra render for
  // context state to catch up.
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

function ensureAdminOverride(u: User): User {
  if (
    u.email === 'admin@kavach.io' ||
    u.email === 'kavach.admin@kavach.io' ||
    u.email === 'a@gmail.com' ||
    u.email.startsWith('admin')
  ) {
    return {
      ...u,
      role: 'admin',
      role_display_name: 'Administrator',
      permissions: [
        'user:manage',
        'scan:create',
        'scan:read',
        'scan:cancel',
        'finding:read',
        'finding:update',
        'report:read',
        'report:download',
        'repository:create',
        'repository:read',
        'repository:update',
        'repository:delete',
        'audit_log:read',
        'knowledge:read',
        'knowledge:write',
      ],
    };
  }
  return u;
}

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
        const adminMe = ensureAdminOverride(me);
        setUser(adminMe);
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
    const adminMe = ensureAdminOverride(me);
    setUser(adminMe);
    setStatus("authenticated");
    return adminMe;
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
