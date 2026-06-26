import { afterEach, describe, expect, it, vi } from 'vitest';

describe('security: production demo and fixture guards', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('rejects production builds with demo mode enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE = 'true';

    const runtime = await import('../../apps/web/lib/runtime-config.js');
    expect(() => runtime.apiUrlFromEnv()).toThrow(/DEMO_MODE/);
  });

  it('rejects production builds with fixture fallback enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK = 'true';

    const runtime = await import('../../apps/web/lib/runtime-config.js');
    expect(() => runtime.apiUrlFromEnv()).toThrow(/FIXTURE_FALLBACK/);
  });
});
