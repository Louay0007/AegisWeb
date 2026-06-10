"use client";

import { apiBaseUrl } from "@/lib/api/api-client";
import {
  clearStoredSession,
  readLegacySession,
  saveAccessToken,
  saveLegacySession,
} from "@/lib/auth/token-storage";
import { isDemoModeEnabled } from "@/lib/runtime-config";

export type AegisUser = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export type AegisSession = {
  accessToken: string;
  expiresInSeconds?: number;
  user: AegisUser;
  mode: "api" | "demo";
};

export type DemoUser = {
  name: string;
  email: string;
  role: string;
  label: string;
  detail: string;
};

export const DEMO_PASSWORD = "Password123!";

export const DEMO_USERS: DemoUser[] = [
  {
    name: "Louay Founder",
    email: "founder@northstarlabs.dev",
    role: "OWNER",
    label: "Owner",
    detail: "Full authority, policies, users, and receipts.",
  },
  {
    name: "Finance Ops",
    email: "finance@northstarlabs.dev",
    role: "APPROVER",
    label: "Approver",
    detail: "Reviews risky renewals and plan changes.",
  },
  {
    name: "Audit Lead",
    email: "auditor@northstarlabs.dev",
    role: "AUDITOR",
    label: "Auditor",
    detail: "Reads evidence without changing authority.",
  },
  {
    name: "Dev Operator",
    email: "dev@northstarlabs.dev",
    role: "DEVELOPER",
    label: "Developer",
    detail: "Tests integrations and workflow behavior.",
  },
];

export function saveSession(session: AegisSession) {
  if (session.mode === "api") {
    saveAccessToken(session.accessToken);
  }
  saveLegacySession(session);
}

export function readSession(): AegisSession | null {
  return readLegacySession() as AegisSession | null;
}

export function clearSession() {
  clearStoredSession();
}

export function demoSessionFor(email: string): AegisSession | null {
  if (!isDemoModeEnabled()) {
    return null;
  }

  const demo = DEMO_USERS.find(
    (user) => user.email.toLowerCase() === email.toLowerCase(),
  );

  if (!demo) {
    return null;
  }

  const session: AegisSession = {
    accessToken: "local-demo-session",
    expiresInSeconds: 3600,
    mode: "demo",
    user: {
      id: demo.email,
      organizationId: "northstar-labs",
      organizationName: "Northstar Labs",
      organizationDomain: "northstarlabs.dev",
      email: demo.email,
      name: demo.name,
      role: demo.role,
      status: "ACTIVE",
    },
  };

  return session;
}

export async function postAuth<TBody extends Record<string, unknown>>(
  path: string,
  body: TBody,
) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    data?: {
      accessToken?: string;
      expiresInSeconds?: number;
      user?: AegisUser;
    };
    error?: { message?: string; requestId?: string };
    message?: string;
  };

  if (!response.ok || !json.data?.accessToken || !json.data.user) {
    const requestId = json.error?.requestId
      ? ` Request ${json.error.requestId}.`
      : "";
    throw new Error(
      `${json.error?.message ?? json.message ?? "Authentication failed."}${requestId}`,
    );
  }

  return {
    accessToken: json.data.accessToken,
    expiresInSeconds: json.data.expiresInSeconds,
    user: json.data.user,
    mode: "api" as const,
  };
}
