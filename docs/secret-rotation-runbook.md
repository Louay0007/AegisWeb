# Secret Rotation Runbook

This runbook covers production rotation for AegisWeb secrets. Record every rotation in the incident/change log with operator, timestamp, reason, affected services, and verification result.

## Preconditions

- Confirm a recent PostgreSQL backup exists and was restore-tested.
- Confirm staging has passed `pnpm smoke` and `pnpm e2e:happy` with the proposed secret changes.
- Freeze non-emergency deploys during rotation.
- Keep old secrets available until verification completes.

## JWT_ACCESS_SECRET

Impact: active access tokens become invalid when the secret changes. Refresh tokens remain valid.

Steps:
1. Generate a 32+ byte random secret.
2. Update `JWT_ACCESS_SECRET` in staging GitHub/Render secrets.
3. Deploy API and verify login, refresh, and `/auth/me`.
4. Update production secret.
5. Deploy API with rolling/blue-green strategy.
6. Verify `GET /health/ready`, login, refresh, and dashboard boot.

Rollback: restore the previous `JWT_ACCESS_SECRET` and redeploy API.

## JWT_REFRESH_SECRET

Impact: all refresh tokens become invalid. Users may need to sign in again.

Steps:
1. Generate a 32+ byte random secret.
2. Announce a possible re-login window.
3. Update staging and verify login/logout/refresh.
4. Update production secret and deploy API.
5. Monitor auth failure rate for 30 minutes.

Rollback: restore the previous secret only if needed immediately. Otherwise keep the new secret and treat re-login as expected.

## BFF_SESSION_SECRET

Impact: browser session cookies become invalid. Users need to sign in again.

Steps:
1. Generate a 32+ byte random secret.
2. Update web runtime secret in staging and production.
3. Deploy web/BFF.
4. Verify login, MFA challenge, refresh, and logout.

Rollback: restore the previous secret and redeploy web.

## VAULT_MASTER_KEY

Impact: credentials cannot be decrypted unless all encrypted payloads are re-encrypted correctly.

Steps:
1. Take a verified PostgreSQL backup and preserve evidence files.
2. Stop workers to prevent active decrypt operations.
3. Generate a base64-encoded 32-byte key.
4. Run the vault re-encryption job in staging against a database copy.
5. Verify every credential decrypts with the new key.
6. In production, run the re-encryption job in batches with audit logs.
7. Update `VAULT_MASTER_KEY` for API and worker.
8. Restart API and worker.
9. Run a workflow requiring credential decrypt and verify audit events.

Rollback: stop workers, restore the database backup, restore the previous `VAULT_MASTER_KEY`, and redeploy API/worker.

## WORKER_INTERNAL_TOKEN

Impact: API-issued worker run tokens and worker-authenticated calls fail if API and worker disagree.

Steps:
1. Generate a 32+ byte random token.
2. Update staging API and worker secrets together.
3. Deploy API first, then worker immediately after.
4. Verify worker health and queue processing.
5. Repeat in production during a low-traffic window.

Rollback: restore the previous token on both API and worker and redeploy both.

## Database Credentials

Steps:
1. Create a new database user with least privilege.
2. Verify migrations and runtime queries in staging.
3. Update `DATABASE_URL` for API, worker, backup jobs, and migration job.
4. Deploy API/worker and run smoke tests.
5. Revoke the old database user after 24 hours of successful operation.

Rollback: restore the previous `DATABASE_URL` and redeploy.

## Verification Checklist

- `GET /health` returns `ok`.
- `GET /health/ready` returns `ok`.
- Login, MFA, refresh, and logout work.
- Worker processes a queued workflow.
- Credential decrypt succeeds for a controlled test run.
- No elevated 5xx, auth failure, or decrypt failure alerts remain open.
