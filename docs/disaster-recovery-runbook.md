# Disaster Recovery Runbook

## Recovery Objectives

| Asset | Frequency | Retention | Restore RTO | Restore RPO |
|-------|-----------|-----------|-------------|-------------|
| PostgreSQL | Daily full + WAL streaming | 30 days | 1 hour | 5 minutes |
| S3/MinIO objects | Continuous replication | 90 days | 2 hours | 15 minutes |
| Redis | AOF + daily RDB | 7 days | 15 minutes | 1 minute |
| Docker images | Per deploy | 30 releases | 10 minutes | N/A |

## General Process

1. Declare incident severity and assign incident commander.
2. Stop non-essential writes if data integrity is uncertain.
3. Preserve logs, database snapshots, object storage versions, and deployment metadata.
4. Execute the scenario-specific recovery procedure.
5. Validate with health checks, smoke tests, E2E happy path, and audit sampling.
6. Document timeline, root cause, customer impact, and follow-ups.

## Scenario 1: Database Corruption

Detection: migration failure, data integrity alerts, Prisma errors, user reports of missing/incorrect records.

Containment:
1. Put API into maintenance mode or stop web traffic.
2. Stop workers to prevent queue-driven writes.
3. Snapshot the corrupted database for forensics.

Recovery:
1. Identify a safe restore point using WAL/PITR or the latest verified backup.
2. Restore into a new database instance.
3. Run `pnpm db:deploy` against the restored database.
4. Run `pnpm smoke` and `pnpm e2e:happy`.
5. Point API/worker `DATABASE_URL` to the restored instance.
6. Resume traffic and workers.

## Scenario 2: Credential Vault Compromise

Detection: suspicious decrypt events, leaked `VAULT_MASTER_KEY`, unauthorized credential usage.

Containment:
1. Stop workers immediately.
2. Disable credential decrypt endpoints by disabling internal worker access.
3. Rotate `WORKER_INTERNAL_TOKEN`.
4. Preserve audit logs and database snapshots.

Recovery:
1. Rotate `VAULT_MASTER_KEY` using `docs/secret-rotation-runbook.md`.
2. Re-encrypt all stored credentials.
3. Revoke and reissue third-party credentials where exposure is possible.
4. Resume workers only after controlled decrypt verification succeeds.

## Scenario 3: Worker Runtime Compromise

Detection: suspicious browser runtime behavior, unexpected network destinations, abnormal worker logs.

Containment:
1. Stop all worker replicas.
2. Revoke `WORKER_INTERNAL_TOKEN`.
3. Disable affected agents and pause queued runs.
4. Snapshot worker filesystem/artifacts for investigation.

Recovery:
1. Deploy a clean worker image from a trusted commit.
2. Rotate worker token and any affected third-party credentials.
3. Resume paused runs manually after audit review.

## Scenario 4: Full Region Failure

Containment:
1. Freeze deploys in the failed region.
2. Confirm latest database backup/WAL and object replication status.

Recovery:
1. Provision a clean environment in the secondary region.
2. Restore PostgreSQL and object storage.
3. Deploy API, worker, and web using the last known-good image tags.
4. Update DNS with low TTL and verify TLS certificates.
5. Run smoke and E2E validation.

## Scenario 5: Security Incident / Credential Leak

Containment:
1. Identify leaked secret class and affected environments.
2. Revoke leaked tokens/keys immediately.
3. Preserve CI/CD, API, worker, database, and object storage logs.

Recovery:
1. Rotate all affected secrets.
2. Redeploy impacted services.
3. Audit account access, workflow runs, credential decrypts, and file access.
4. Notify affected customers if any data exposure is confirmed.
