# Phase 22 Completion Notes: ConnectorModule

Implemented: 2026-06-06

## Summary

Phase 22 adds the first vendor-specific worker connector: `SandboxVendorConnector`.

The connector drives the deterministic local Acme Analytics sandbox through the controlled browser runtime, receives credentials from execution context, asks a worker policy client before actions, and records action attempts through worker services.

## Added Files

```text
apps/worker/src/connector/vendor-connector.types.ts
apps/worker/src/connector/connector-action-attempt.service.ts
apps/worker/src/connector/sandbox-vendor.connector.ts
apps/worker/src/policy-client/worker-policy-client.service.ts
tests/phase22-connector.spec.ts
```

## Connector Contract

Implemented interface:

```ts
interface VendorConnector {
  login(context): Promise<void>;
  downloadLatestInvoice(context): Promise<FileResult>;
  readRenewalInfo(context): Promise<RenewalInfo>;
  prepareDowngrade(context): Promise<ProposedAction>;
  submitDowngrade(context): Promise<ActionResult>;
}
```

## SandboxVendorConnector

Implemented:

- Login with credentials supplied by `ConnectorExecutionContext`.
- Latest invoice download via browser runtime.
- Renewal data extraction from sandbox billing page.
- Downgrade proposal preparation.
- Downgrade submission guard that requires an approval token.

The connector does not decrypt credentials. It only receives already-provided credentials from runtime execution context.

## Worker Policy Client

Added a conservative local `WorkerPolicyClient` until the internal worker API hardening phases:

- Allows read-only and download actions.
- Requires approval for risky actions such as `change_plan`.
- Denies admin/user-management style actions.

## Action Attempts

Added `ConnectorActionAttemptService` for worker-side action attempt records.

It records:

- `credential_injection` for login.
- `download_file` for invoice download.
- `read_page` for renewal extraction.
- `change_plan` with `require_approval` for downgrade proposal.

Secrets are not stored in metadata; login attempt metadata stores the username only.

## Tests

Added:

```text
tests/phase22-connector.spec.ts
```

Coverage:

- Sandbox connector logs in.
- Connector receives credentials from execution context.
- Connector does not store plaintext password in action-attempt metadata.
- Connector downloads latest invoice.
- Connector extracts renewal info.
- Connector prepares downgrade proposal with approval-required policy state.
- Connector refuses downgrade submission without approval token/state.

## Validation

Targeted validation passed:

```bash
pnpm typecheck
pnpm test -- tests/phase22-connector.spec.ts --pool=forks --poolOptions.forks.singleFork=true
```

Full validation should be run before Phase 23:

```bash
pnpm lint
pnpm test
pnpm smoke
```
