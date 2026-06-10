# AegisWeb Production Runbook

Generated: 2026-06-09

This runbook describes a staging/production deployment path for the API, worker, and web dashboard. It assumes managed Postgres, Redis, S3-compatible object storage, and SMTP/email provider credentials are already provisioned.

## Required Runtime Services

- Postgres 17-compatible database.
- Redis 8-compatible instance for BullMQ queues.
- S3-compatible bucket for workflow evidence and receipt exports.
- SMTP provider for approval notifications.
- HTTPS domains for web and API.

## Required API/Worker Environment

- `NODE_ENV=production`
- `API_PORT=3001`
- `DATABASE_URL=postgresql://...`
- `REDIS_URL=rediss://...` or `redis://...` on a private network
- `JWT_ACCESS_SECRET` with at least 32 characters
- `JWT_REFRESH_SECRET` with at least 32 characters
- `VAULT_MASTER_KEY` with at least 32 characters or a base64 encoded 32-byte key
- `WORKER_INTERNAL_TOKEN` with at least 32 characters
- `DASHBOARD_BASE_URL=https://app.<domain>`
- `API_ALLOWED_ORIGINS=https://app.<domain>`
- `ENABLE_OPENAPI=false`
- `ALLOW_LOCAL_PRODUCTION_DEPENDENCIES=false`
- `S3_ENDPOINT=https://...`
- `S3_REGION=<region>`
- `S3_BUCKET=<bucket>`
- `S3_ACCESS_KEY=<access key>`
- `S3_SECRET_KEY=<secret key>`
- `S3_FORCE_PATH_STYLE=false` unless the provider requires path-style
- `MAIL_HOST=<smtp host>`
- `MAIL_PORT=587`
- `MAIL_FROM=AegisWeb <security@domain>`
- `VENDOR_SANDBOX_URL=<staging vendor sandbox or connector base URL>`

## Required Web Build Environment

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_URL=https://api.<domain>`
- `NEXT_PUBLIC_ENABLE_DEMO_MODE=false`
- `NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false`

## Build Images

Use the repository root as Docker build context.

```bash
docker build -f apps/api/Dockerfile -t aegisweb-api:<git-sha> .
docker build -f apps/worker/Dockerfile -t aegisweb-worker:<git-sha> .
docker build -f apps/web/Dockerfile -t aegisweb-web:<git-sha> --build-arg NEXT_PUBLIC_API_URL=https://api.<domain> .
```

Do not bake `.env` files or secrets into images. Inject secrets through the runtime platform.

## Migration Process

Run Prisma migrations once per deploy before starting new API/worker replicas.

```bash
pnpm db:deploy
```

Use `prisma migrate deploy`, not `prisma migrate dev`, in staging and production.

## Startup Order

1. Confirm Postgres, Redis, S3, and SMTP are reachable.
2. Deploy API with `start:api`.
3. Wait for API liveness and readiness.
4. Deploy worker with `start:worker`.
5. Deploy web with `pnpm --filter my-v0-project start` or equivalent Next.js runtime command.
6. Run smoke and E2E validation.

## Health Checks

- API liveness: `GET https://api.<domain>/health`
- API readiness: `GET https://api.<domain>/health/ready`
- OpenAPI in production: `GET /docs` and `GET /docs-json` should return unavailable/not routed unless intentionally protected.
- Web dashboard: `GET https://app.<domain>/login`
- Mail delivery: trigger an approval request and verify provider delivery logs.
- Worker: verify jobs move from `workflow-runs` or `workflow-resume` to completed/failed states and worker logs contain heartbeats.

## Production-Mode Validation

- Demo login with `Password123!` must fail unless real credentials exist.
- `?demo=1` must not bypass route protection.
- API unavailable states must show errors or empty UI, never fixture records.
- `/app/*` must redirect before dashboard render when no session marker exists.
- Refresh/logout with cross-site `Origin` must be rejected.
- `/docs` and `/docs-json` must not be public.

## Rollback

1. Stop new web traffic to the failing release.
2. Roll API, worker, and web images back to the previous known-good image tag.
3. Do not roll back database schema unless a tested down-migration or restore plan exists.
4. If migrations caused data corruption, restore from the latest verified Postgres backup and preserve audit/file evidence snapshots.
5. Re-run health checks and the E2E happy path.

## Logs And Metrics

- API logs: request IDs, auth failures, internal errors, CORS/origin rejections.
- Worker logs: queue name, job ID, workflow run ID, failures, heartbeat entries.
- Postgres metrics: connection count, slow queries, storage, backup success.
- Redis metrics: queue depth, memory, CPU, connection count.
- S3 metrics: object count, bytes stored, failed writes/reads.
- Mail metrics: delivery failures, bounce rate, approval notification latency.

## Staging Checklist

- Use separate staging secrets and infrastructure.
- Keep `NEXT_PUBLIC_ENABLE_DEMO_MODE=false` and `NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false` for production-mode validation.
- Run `pnpm smoke`, `pnpm test`, `pnpm e2e:happy`, `pnpm qa:click-path`, and `pnpm qa:responsive` against staging before promotion.
