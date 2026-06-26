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

import { apiPost, apiRequest } from "@/lib/api/api-client";
import { ApiError, isApiError } from "@/lib/api/api-errors";
import { isDemoModeEnabled } from "@/lib/runtime-config";

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
  emailVerifiedAt?: string | null;
  mfaEnabled?: boolean;
  mfaRequired?: boolean;
};

export type AuthSession = {
  mode: AuthMode;
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
    try {
      const me = await apiRequest<{ user: AuthUser }>(
        "/auth/me",
        {},
        { retry: false },
      );
      const session: AuthSession = {
        mode: "api",
        user: me.user,
      };
      setState({ status: "authenticated", session });
    } catch (error) {
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
    const data = await apiPost<{ user: AuthUser; mfaRequired?: boolean; tempToken?: string }>(
      "/auth/login",
      { email, password },
    );
    if (data.mfaRequired && data.tempToken) {
      throw new MfaRequiredError(data.tempToken);
    }
    const session: AuthSession = {
      mode: "api",
      user: data.user,
    };
    setState({ status: "authenticated", session });
    return session;
  }, []);

  const saveApiSession = useCallback((session: AuthSession) => {
    setState({ status: "authenticated", session });
  }, []);

  const saveDemoSession = useCallback((session: AuthSession) => {
    if (!isDemoModeEnabled()) {
      throw new Error("Demo mode is disabled.");
    }
    setState({ status: "demo", session });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiPost<{ ok: true }>("/auth/logout", {});
    } catch {
      // Local sign-out must still clear state even if the API is offline.
    }

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

export function authErrorMessage(error: unknown) {
  if (error instanceof MfaRequiredError) return "Multi-factor authentication is required.";
  if (error instanceof ApiError) {
    return error.requestId
      ? `${error.message} Request ${error.requestId}.`
      : error.message;
  }

  return error instanceof Error ? error.message : "Authentication failed.";
}

export class MfaRequiredError extends Error {
  constructor(readonly tempToken: string) {
    super("Multi-factor authentication is required.");
    this.name = "MfaRequiredError";
  }
}
