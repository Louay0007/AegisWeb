# AegisWeb Render Deployment Guide

Last updated: 2026-06-10

This guide explains how to deploy AegisWeb on Render and how to add a 10-minute keepalive cron for Free web services.

## Important Reality Check

AegisWeb is not a single-container app. The full product needs:

- API web service.
- Next.js web dashboard.
- Worker process for BullMQ and Playwright workflows.
- Postgres database.
- Redis-compatible queue.
- S3-compatible object storage.
- SMTP provider.
- Optional vendor sandbox for the local demo connector.

Render Free can work for hobby/demo web services, but it is not a full lifetime-free production setup for this project. Free web services sleep after inactivity, and the worker should be a Render Background Worker, which is a continuously running non-HTTP service.

Use this guide in two modes:

- Demo mode on Render Free: API and web can run as Free web services, with an external keepalive. Expect compromises.
- Real staging/production: use paid API/web/worker compute plus managed Postgres, Redis-compatible Key Value, S3-compatible storage, and SMTP.

## Recommended Render Services

Create these services from the same Git repository:

| Service | Render Type | Dockerfile | Port | Notes |
| --- | --- | --- | --- | --- |
| `aegisweb-api` | Web Service | `apps/api/Dockerfile` | `3001` | Public API. |
| `aegisweb-web` | Web Service | `apps/web/Dockerfile` | `3000` | Next.js dashboard and marketing site. |
| `aegisweb-worker` | Background Worker | `apps/worker/Dockerfile` | none | Required for workflow execution. |
| `aegisweb-vendor-sandbox` | Web Service | `apps/vendor-sandbox/Dockerfile` | `4202` | Optional demo-only fake SaaS portal. |
| Postgres | Render Postgres or external | n/a | n/a | Use PostgreSQL 17-compatible. |
| Redis | Render Key Value or external Redis | n/a | n/a | BullMQ queue backend. |
| Object storage | External S3-compatible provider | n/a | n/a | Cloudflare R2, AWS S3, Backblaze B2, etc. |
| SMTP | External SMTP provider | n/a | n/a | Resend, Postmark, SendGrid, Mailgun, etc. |

## Before You Deploy

Generate strong secrets:

```bash
node -e "console.log(crypto.randomBytes(48).toString('base64'))"
```

Create at least these four secrets:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `VAULT_MASTER_KEY`
- `WORKER_INTERNAL_TOKEN`

Each must be at least 32 characters in production. Keep `WORKER_INTERNAL_TOKEN` identical on the API and worker.

## API Service

Create a new Render Web Service:

- Name: `aegisweb-api`
- Environment: Docker
- Dockerfile path: `apps/api/Dockerfile`
- Port: `3001`
- Health check path: `/health/ready`
- Instance type: Free for demo, paid for serious use.

Environment variables:

```env
NODE_ENV=production
API_PORT=3001
DATABASE_URL=<your-postgres-url>
REDIS_URL=<your-redis-url>
JWT_ACCESS_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<strong-secret>
VAULT_MASTER_KEY=<strong-secret-or-base64-32-byte-key>
S3_ENDPOINT=<s3-compatible-endpoint>
S3_REGION=<region>
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
S3_FORCE_PATH_STYLE=false
MAIL_HOST=<smtp-host>
MAIL_PORT=587
MAIL_FROM=AegisWeb <security@your-domain.com>
DASHBOARD_BASE_URL=https://aegisweb-web.onrender.com
WORKER_INTERNAL_TOKEN=<same-strong-token-used-by-worker>
VENDOR_SANDBOX_URL=https://aegisweb-vendor-sandbox.onrender.com
API_ALLOWED_ORIGINS=https://aegisweb-web.onrender.com
ENABLE_OPENAPI=false
ALLOW_LOCAL_PRODUCTION_DEPENDENCIES=false
```

If your S3-compatible provider requires path-style addressing, set:

```env
S3_FORCE_PATH_STYLE=true
```

## Database Migrations

Run migrations before the first real deploy and before future releases:

```bash
pnpm db:deploy
```

On Render paid services, prefer a pre-deploy command if available for your service type:

```bash
pnpm db:deploy
```

For a demo-only deployment, you can temporarily override the API Docker command to run migrations on boot:

```bash
pnpm db:deploy && pnpm start:api
```

Only seed demo data intentionally:

```bash
pnpm db:seed
```

Do not run `pnpm db:seed` automatically in production unless this is a disposable demo database.

## Web Service

Create a new Render Web Service:

- Name: `aegisweb-web`
- Environment: Docker
- Dockerfile path: `apps/web/Dockerfile`
- Port: `3000`
- Health check path: `/login`
- Instance type: Free for demo, paid for serious use.

Build/runtime environment variables:

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://aegisweb-api.onrender.com
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
NEXT_PUBLIC_ENABLE_FIXTURE_FALLBACK=false
NEXT_PUBLIC_ALLOW_LOCAL_API_URL=false
```

After you know the final web URL, update the API service:

```env
DASHBOARD_BASE_URL=https://aegisweb-web.onrender.com
API_ALLOWED_ORIGINS=https://aegisweb-web.onrender.com
```

Then redeploy the API.

## Worker Service

Create a new Render Background Worker:

- Name: `aegisweb-worker`
- Environment: Docker
- Dockerfile path: `apps/worker/Dockerfile`
- Start command: use Dockerfile default, or `pnpm start:worker`

Environment variables:

```env
NODE_ENV=production
API_BASE_URL=https://aegisweb-api.onrender.com
API_PORT=3001
DATABASE_URL=<same-postgres-url>
REDIS_URL=<same-redis-url>
WORKER_INTERNAL_TOKEN=<same-token-as-api>
S3_ENDPOINT=<same-s3-endpoint>
S3_REGION=<same-s3-region>
S3_BUCKET=<same-s3-bucket>
S3_ACCESS_KEY=<same-s3-access-key>
S3_SECRET_KEY=<same-s3-secret-key>
S3_FORCE_PATH_STYLE=false
VENDOR_SANDBOX_URL=https://aegisweb-vendor-sandbox.onrender.com
```

The worker Dockerfile installs Playwright Chromium and its system dependencies. The first build can take a while.

## Optional Vendor Sandbox

Deploy this only for demo workflows against the fake SaaS vendor:

- Name: `aegisweb-vendor-sandbox`
- Environment: Docker
- Dockerfile path: `apps/vendor-sandbox/Dockerfile`
- Port: `4202`
- Health check path: `/health`

Environment variables:

```env
NODE_ENV=production
VENDOR_SANDBOX_PORT=4202
```

Then set this value on both API and worker:

```env
VENDOR_SANDBOX_URL=https://aegisweb-vendor-sandbox.onrender.com
```

## Keepalive Cron For Render Free

Render Free web services sleep after inactivity. The cron must run outside the sleeping service.

This repo includes:

```text
.github/workflows/render-keepalive.yml
```

Add these GitHub repository secrets or variables:

- `RENDER_API_URL` = `https://aegisweb-api.onrender.com`
- `RENDER_WEB_URL` = `https://aegisweb-web.onrender.com`

The workflow pings:

- `$RENDER_API_URL/health`
- `$RENDER_WEB_URL/login`

It runs every 10 minutes.

Alternative external cron services:

- cron-job.org
- UptimeRobot
- Better Stack
- Cloudflare Worker Cron Trigger

Ping these URLs every 10 minutes:

```text
https://aegisweb-api.onrender.com/health
https://aegisweb-web.onrender.com/login
```

## Verify Deployment

API:

```bash
curl -fsS https://aegisweb-api.onrender.com/health
curl -fsS https://aegisweb-api.onrender.com/health/ready
```

Web:

```bash
curl -I https://aegisweb-web.onrender.com/login
```

Demo login, only if you intentionally seeded demo data:

```text
founder@northstarlabs.dev
Password123!
```

Expected checks:

- `/docs` and `/docs-json` are not publicly enabled in production.
- Login works only with real users in the database.
- Dashboard requests hit the Render API URL, not localhost.
- Starting a workflow creates a run and enqueues a BullMQ job.
- Worker logs show queue processing and heartbeats.
- Evidence files upload to S3-compatible storage.
- Approval email attempts reach your SMTP provider.

## Troubleshooting

### Web build cannot reach the API

Make sure `NEXT_PUBLIC_API_URL` is an HTTPS URL:

```env
NEXT_PUBLIC_API_URL=https://aegisweb-api.onrender.com
```

### API rejects browser requests

Update API CORS settings:

```env
API_ALLOWED_ORIGINS=https://aegisweb-web.onrender.com
DASHBOARD_BASE_URL=https://aegisweb-web.onrender.com
```

### Worker cannot call internal API routes

Check that both services have the exact same:

```env
WORKER_INTERNAL_TOKEN=<same-token>
```

Also check:

```env
API_BASE_URL=https://aegisweb-api.onrender.com
```

### Workflows never run

Check:

- Redis/Key Value URL is reachable from API and worker.
- Worker service is running.
- `workflow-runs` queue has jobs.
- API and worker use the same `DATABASE_URL` and `REDIS_URL`.

### Screenshots or invoices fail

Check S3 settings:

```env
S3_ENDPOINT=...
S3_REGION=...
S3_BUCKET=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_FORCE_PATH_STYLE=...
```

### Free service still sleeps

Check that the keepalive cron is external and actually hitting your Render URLs. Internal app timers do not work after a service sleeps.

Also remember that keeping a Free web service awake consumes Free instance hours and can hit monthly limits.
