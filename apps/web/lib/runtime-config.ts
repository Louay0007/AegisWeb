export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function publicFlag(name: string): boolean | null {
  const value = publicEnvValue(name);
  if (value === undefined) return null;
  return value === "true" || value === "1";
}

function publicEnvValue(name: string): string | undefined {
  switch (name) {
    case "NEXT_PUBLIC_ENABLE_DEMO_MODE":
      return process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE;
    case "NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK":
      return process.env.NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK;
    case "NEXT_PUBLIC_ALLOW_LOCAL_API_URL":
      return process.env.NEXT_PUBLIC_ALLOW_LOCAL_API_URL;
    default:
      return undefined;
  }
}

export function isDemoModeEnabled() {
  const configured = publicFlag("NEXT_PUBLIC_ENABLE_DEMO_MODE");
  return configured ?? !isProductionRuntime();
}

export function isFixtureFallbackEnabled() {
  const configured = publicFlag("NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK");
  return configured ?? !isProductionRuntime();
}

export function isLocalApiUrlAllowed() {
  return publicFlag("NEXT_PUBLIC_ALLOW_LOCAL_API_URL") === true;
}

function assertProductionPublicFlags() {
  if (!isProductionRuntime()) {
    return;
  }

  if (publicFlag("NEXT_PUBLIC_ENABLE_DEMO_MODE") === true) {
    throw new Error("NEXT_PUBLIC_ENABLE_DEMO_MODE must be false in production.");
  }

  if (publicFlag("NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK") === true) {
    throw new Error("NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK must be false in production.");
  }
}

export function apiUrlFromEnv() {
  assertProductionPublicFlags();
  const url = process.env.NEXT_PUBLIC_API_URL;

  if (isProductionRuntime()) {
    if (!url) {
      throw new Error("NEXT_PUBLIC_API_URL is required in production.");
    }

    const parsed = new URL(url);
    if (!url.startsWith("https://")) {
      throw new Error("NEXT_PUBLIC_API_URL must use HTTPS in production.");
    }
    if (!isLocalApiUrlAllowed() && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      throw new Error("NEXT_PUBLIC_API_URL must not point to localhost in production.");
    }
  }

  return (url ?? "http://localhost:3001").replace(/\/$/, "");
}
