/**
 * Centralized feature flag helpers that decide whether the dashboard should
 * hit the live API or fall back to the bundled fixture data.
 *
 * Keeping this in one place means the React Query layer and the auth layer
 * can both inspect the same source of truth.
 */

import { isFixtureFallbackEnabled } from "@/lib/runtime-config";

let inMemoryFixtureOverride: boolean | null = null;

export function isFixtureMode(): boolean {
  if (!isFixtureFallbackEnabled()) {
    return false;
  }

  if (inMemoryFixtureOverride !== null) {
    return inMemoryFixtureOverride;
  }

  if (typeof window === "undefined") {
    return false;
  }

  // Allow developers to force fixture mode in the browser without going
  // through the auth flow (handy for offline design reviews).
  return window.localStorage.getItem("aegisweb.fixture") === "1";
}

export function setFixtureMode(enabled: boolean) {
  inMemoryFixtureOverride = isFixtureFallbackEnabled() ? enabled : false;
  if (typeof window !== "undefined") {
    if (enabled && isFixtureFallbackEnabled()) {
      window.localStorage.setItem("aegisweb.fixture", "1");
    } else {
      window.localStorage.removeItem("aegisweb.fixture");
    }
  }
}

export function readAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem("aegisweb.access_token");
}
