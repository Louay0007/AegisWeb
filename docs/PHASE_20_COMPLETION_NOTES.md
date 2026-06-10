# Phase 20 Completion Notes: Browser Runtime Library

Implemented: 2026-06-06

## Summary

Phase 20 replaces the placeholder browser runtime with a controlled Playwright wrapper for AgentPass worker actions.

The runtime now exposes a small public API that enforces navigation/domain rules, captures screenshots, masks credential fields before capture, records final URLs, extracts DOM metadata, captures downloads, and closes browser resources on errors.

## Dependency

Added workspace dependency:

```text
playwright
```

Installed local Chromium browser for Playwright:

```bash
pnpm exec playwright install chromium
```

## Public API

Implemented in:

```text
libs/browser-runtime/src/index.ts
```

Exports:

```ts
createControlledContext(runContext)
navigateWithPolicy(url)
fillCredentialField(selector, value)
clickWithActionAttempt(selector, actionMetadata)
downloadWithCapture(selector, actionMetadata)
captureScreenshot(label)
extractDomMetadata()
closeContext()
getBrowserRuntimeStatus()
```

## Guardrails

Implemented:

- Domain allowlist before navigation.
- Domain allowlist check after navigation.
- Screenshot before and after sensitive clicks.
- Password/secret field masking marker before screenshot.
- Per-step timeout through Playwright default timeouts.
- Unknown popup/new-tab closure.
- Final URL returned after navigation.
- Download capture only when action metadata explicitly allows download and uses `download_file`.
- Browser context closes on navigation-policy errors.

## Runtime Artifacts

Screenshots are saved as PNG files under the configured artifact directory.

Downloads are saved under the configured artifact directory and return metadata:

```text
label
suggestedFilename
path
sizeBytes
sha256
url
capturedAt
```

## Tests

Added:

```text
tests/phase20-browser-runtime.spec.ts
```

Coverage:

- Runtime status reports Playwright controlled runtime.
- Domain allowlist allows local sandbox navigation.
- Unknown domain is blocked.
- Context closes on navigation-policy error.
- Screenshot file is created.
- Password masking script runs before screenshot.
- Sensitive click captures before and after screenshots.
- Download capture stores file metadata.
- Download capture rejects non-download action metadata.
- DOM metadata extraction returns title, headings, forms, and links.

## Validation

Targeted validation passed:

```bash
pnpm typecheck
pnpm test -- tests/phase20-browser-runtime.spec.ts --pool=forks --poolOptions.forks.singleFork=true
```

Full validation should be run before Phase 21:

```bash
pnpm lint
pnpm test
pnpm smoke
```
