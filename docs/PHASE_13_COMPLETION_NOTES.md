# Phase 13 Completion Notes

Implemented: 2026-06-06

## Scope

Phase 13 adds the real vault crypto library and API credential management.

Implemented library API:

- `encryptSecret(plaintext, masterKey)`
- `decryptSecret(payload, masterKey)`
- `redactSecretLikeValues(value)`
- `assertValidMasterKey(key)`
- `getVaultStatus()`

Implemented endpoints:

- `GET /credentials`
- `POST /credentials`
- `GET /credentials/:id`
- `PATCH /credentials/:id`
- `POST /credentials/:id/grants`
- `DELETE /credentials/:id/grants/:grantId`
- `POST /credentials/:id/revoke`
- `POST /internal/vault/credentials/:id/decrypt-for-run`

## Behavior

- Credentials are encrypted with AES-256-GCM before storage.
- API responses never include plaintext or the encrypted payload.
- Plaintext is accepted only in `secretJson` on create and rotate/update.
- Credential grants are scoped to organization-owned agents.
- Revoked grants block internal decryption.
- Revoked credentials block update, grant, and internal decryption.
- Internal decryption requires the worker token and a workflow run in the same organization.
- The workflow run vendor must match the credential vendor when the run has a vendor.
- The credential must be actively granted to the workflow run agent.
- Decryption records `credential_used` audit without storing plaintext secrets.
- Seeded demo credentials now use the shared vault library format.

## Audit Events

- `credential_created`
- `credential_updated`
- `credential_granted_to_agent`
- `credential_grant_revoked`
- `credential_revoked`
- `credential_used`

## Tests Added

`tests/phase13-credentials-vault.spec.ts` covers:

- AES-256-GCM encrypt/decrypt round trip.
- Wrong key failure.
- Tamper failure.
- Recursive redaction.
- Master key validation.
- Credential create with encrypted storage.
- List/get responses without plaintext or encrypted payload.
- Granting credentials to agents.
- Internal decrypt with worker token and authorized workflow run.
- Grant revocation blocking decrypt.
- Credential revocation blocking decrypt.
- Secret rotation without leakage.
- RBAC and cross-organization denial.
