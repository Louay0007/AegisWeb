"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiPost, apiRequest, refreshAccessToken } from "@/lib/api/api-client";
import { ApiError, isApiError } from "@/lib/api/api-errors";
import {
  clearStoredSession,
  readAccessToken,
  readLegacySession,
  saveAccessToken,
  saveLegacySession,
} from "@/lib/auth/token-storage";
import { isDemoModeEnabled, isProductionRuntime } from "@/lib/runtime-config";

export type AuthMode = "api" | "demo";

export type AuthUser = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export type AuthSession = {
  mode: AuthMode;
  accessToken: string | null;
  user: AuthUser;
};

export type AuthSessionState =
  | { status: "booting" }
  | { status: "authenticated"; session: AuthSession }
  | { status: "demo"; session: AuthSession }
  | { status: "unauthenticated" }
  | { status: "error"; message: string; requestId?: string };

type AuthContextValue = {
  state: AuthSessionState;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  saveApiSession: (session: AuthSession) => void;
  saveDemoSession: (session: AuthSession) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthSessionState>({ status: "booting" });

  const boot = useCallback(async () => {
    const legacy = readLegacySession() as Partial<AuthSession> | null;

    if (isDemoModeEnabled() && legacy?.mode === "demo" && legacy.user) {
      setState({
        status: "demo",
        session: normalizeSession(legacy as AuthSession),
      });
      return;
    }

    const token = readAccessToken() ?? (!isProductionRuntime() ? legacy?.accessToken : null) ?? null;
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      try {
        const me = await apiRequest<{ user: AuthUser }>(
          "/auth/me",
          {},
          { retry: false },
        );
        const session: AuthSession = {
          mode: "api",
          accessToken: refreshed,
          user: me.user,
        };
        saveLegacySession(session);
        setState({ status: "authenticated", session });
        return;
      } catch {
        clearStoredSession();
        setState({ status: "unauthenticated" });
      }
      return;
    }

    try {
      saveAccessToken(token);
      const me = await apiRequest<{ user: AuthUser }>(
        "/auth/me",
        {},
        { retry: true },
      );
      const session: AuthSession = {
        mode: "api",
        accessToken: readAccessToken(),
        user: me.user,
      };
      saveLegacySession(session);
      setState({ status: "authenticated", session });
    } catch (error) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        try {
          const me = await apiRequest<{ user: AuthUser }>(
            "/auth/me",
            {},
            { retry: false },
          );
          const session: AuthSession = {
            mode: "api",
            accessToken: refreshed,
            user: me.user,
          };
          saveLegacySession(session);
          setState({ status: "authenticated", session });
          return;
        } catch {
          // Fall through to unauthenticated state.
        }
      }

      clearStoredSession();
      if (isApiError(error) && error.status && error.status >= 500) {
        setState({
          status: "error",
          message: error.message,
          requestId: error.requestId,
        });
        return;
      }
      setState({ status: "unauthenticated" });
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await apiPost<{ accessToken: string; user: AuthUser }>(
      "/auth/login",
      { email, password },
    );
    saveAccessToken(data.accessToken);
    const session: AuthSession = {
      mode: "api",
      accessToken: data.accessToken,
      user: data.user,
    };
    saveLegacySession(session);
    setState({ status: "authenticated", session });
    return session;
  }, []);

  const saveApiSession = useCallback((session: AuthSession) => {
    if (session.accessToken) {
      saveAccessToken(session.accessToken);
    }
    saveLegacySession(session);
    setState({ status: "authenticated", session });
  }, []);

  const saveDemoSession = useCallback((session: AuthSession) => {
    if (!isDemoModeEnabled()) {
      throw new Error("Demo mode is disabled.");
    }
    saveLegacySession(session);
    setState({ status: "demo", session });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiPost<{ ok: true }>("/auth/logout", {});
    } catch {
      // Local sign-out must still clear state even if the API is offline.
    }

    clearStoredSession();
    setState({ status: "unauthenticated" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn,
      saveApiSession,
      saveDemoSession,
      signOut,
      refresh: boot,
    }),
    [boot, saveApiSession, saveDemoSession, signIn, signOut, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }

  return context;
}

function normalizeSession(session: AuthSession): AuthSession {
  return {
    ...session,
    accessToken: session.accessToken ?? null,
    user: session.user,
  };
}

export function authErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.requestId
      ? `${error.message} Request ${error.requestId}.`
      : error.message;
  }

  return error instanceof Error ? error.message : "Authentication failed.";
}
