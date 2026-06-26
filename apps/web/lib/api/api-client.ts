"use client";

import { ApiError } from "@/lib/api/api-errors";
import type { PaginationMeta } from "@/lib/api/pagination";

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
  return "";
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
  _options: { retry?: boolean } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${bffPath(path)}`, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init.headers, init.body),
  });

  return readEnvelope<T>(response);
}

export async function apiGet<T>(path: string) {
  return apiRequest<T>(path);
}

export async function apiGetPaginated<T>(
  path: string,
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const response = await fetch(`${apiBaseUrl()}${bffPath(path)}`, {
    credentials: "include",
    headers: buildHeaders({}),
  });

  const json = (await response.json().catch(() => ({}))) as {
    data?: T[];
    meta?: PaginationMeta;
    error?: { code?: string; message?: string };
    message?: string;
  };

  if (!response.ok) {
    throw new ApiError({
      code: json.error?.code ?? `HTTP_${response.status}`,
      message: json.error?.message ?? json.message ?? response.statusText,
      status: response.status,
    });
  }

  return {
    data: (json.data ?? []) as T[],
    meta: json.meta ?? { total: 0, page: 1, limit: 20, totalPages: 0 },
  };
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

export async function apiDownload(path: string) {
  const response = await fetch(`${apiBaseUrl()}${bffPath(path)}`, {
    credentials: "include",
    headers: buildHeaders(undefined),
  });

  if (!response.ok) {
    return readEnvelope<never>(response);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? "aegisweb-receipt.json";
  return { blob, filename };
}

function buildHeaders(input: HeadersInit | undefined, body?: BodyInit | null) {
  const headers = new Headers(input);

  if (body !== undefined && body !== null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", createRequestId());
  }

  return headers;
}

function bffPath(path: string): string {
  if (path.startsWith("/api/")) return path;
  if (path.startsWith("/auth/")) return `/api${path}`;
  return `/api/proxy${path.startsWith("/") ? path : `/${path}`}`;
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
