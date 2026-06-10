import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'apps/**/*.spec.{ts,tsx}', 'libs/**/*.spec.ts'],
    testTimeout: 15000,
    environmentMatchGlobs: [
      ['apps/web/**/*.spec.{ts,tsx}', 'jsdom'],
    ]
  },
  resolve: {
    alias: {
      '@agentpass/audit': new URL('./libs/audit/src/index.ts', import.meta.url).pathname,
      '@agentpass/browser-runtime': new URL('./libs/browser-runtime/src/index.ts', import.meta.url).pathname,
      '@agentpass/database': new URL('./libs/database/src/index.ts', import.meta.url).pathname,
      '@agentpass/domain': new URL('./libs/domain/src/index.ts', import.meta.url).pathname,
      '@agentpass/policy-engine': new URL('./libs/policy-engine/src/index.ts', import.meta.url).pathname,
      '@agentpass/testing': new URL('./libs/testing/src/index.ts', import.meta.url).pathname,
      '@agentpass/vault': new URL('./libs/vault/src/index.ts', import.meta.url).pathname,
      '@': new URL('./apps/web', import.meta.url).pathname
    }
  }
});
