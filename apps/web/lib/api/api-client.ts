"use client";

import { ApiError } from "@/lib/api/api-errors";
import {
  clearAccessToken,
  readAccessToken,
  saveAccessToken,
} from "@/lib/auth/token-storage";
import { apiUrlFromEnv } from "@/lib/runtime-config";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
  message?: string;
};

export function apiBaseUrl() {
  return apiUrlFromEnv();
}

export function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { retry?: boolean } = {},
): Promise<T> {
  const retry = options.retry ?? true;
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init.headers),
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, init, { retry: false });
    }
  }

  return readEnvelope<T>(response);
}

export async function apiGet<T>(path: string) {
  return apiRequest<T>(path);
}

export async function apiPost<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string) {
  return apiRequest<T>(path, { method: "DELETE" });
}

export async function apiDownload(path: string, retry = true) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: "include",
    headers: buildHeaders(undefined),
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiDownload(path, false);
  }

  if (!response.ok) {
    return readEnvelope<never>(response);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? "aegisweb-receipt.json";
  return { blob, filename };
}

export async function refreshAccessToken() {
  try {
    const data = await apiRequest<{ accessToken: string }>(
      "/auth/refresh",
      { method: "POST", body: "{}" },
      { retry: false },
    );
    saveAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    clearAccessToken();
    return null;
  }
}

function buildHeaders(input: HeadersInit | undefined) {
  const headers = new Headers(input);
  const token = readAccessToken();

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", createRequestId());
  }

  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new ApiError({
      code: json.error?.code ?? `HTTP_${response.status}`,
      message: json.error?.message ?? json.message ?? response.statusText,
      requestId: json.error?.requestId,
      details: json.error?.details,
      status: response.status,
    });
  }

  if (!("data" in json)) {
    return json as T;
  }

  return json.data as T;
}
