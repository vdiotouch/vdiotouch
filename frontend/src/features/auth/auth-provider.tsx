import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FullPageLoader } from "@/components/feedback/full-page-loader";
import {
  clearSession,
  getAccessToken,
  onSessionCleared,
  refreshAccessToken,
  setAccessToken,
} from "@/shared/api/session";
import { authApi, type User } from "./api";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Module-level snapshot so router guards (outside React) can read auth state.
export const authState: { user: User | null } = { user: null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = React.useState<User | null>(null);
  const [ready, setReady] = React.useState(false);

  const update = React.useCallback((next: User | null) => {
    authState.user = next;
    setUser(next);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getAccessToken()) await refreshAccessToken();
        if (getAccessToken()) {
          const me = await authApi.me();
          if (!cancelled) update(me);
        }
      } catch {
        clearSession();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [update]);

  React.useEffect(
    () =>
      onSessionCleared(() => {
        update(null);
        queryClient.clear();
      }),
    [update, queryClient],
  );

  const value = React.useMemo<AuthContextValue>(() => {
    const finish = async (token: string) => {
      setAccessToken(token);
      update(await authApi.me());
    };
    return {
      user,
      login: async (email, password) =>
        finish((await authApi.login(email, password)).token.access_token),
      signup: async (name, email, password) =>
        finish((await authApi.signup(name, email, password)).token.access_token),
      logout: clearSession,
    };
  }, [user, update]);

  if (!ready) return <FullPageLoader />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
