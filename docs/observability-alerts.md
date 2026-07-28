# Observability and alert thresholds

Use these thresholds for staging and production monitoring of AegisWeb.

## Core signals

| Signal | Source | Warning | Critical |
| --- | --- | ---: | ---: |
| API 5xx rate | Prometheus `http_requests_total` | > 1% over 5m | > 5% over 5m |
| API p95 latency | Prometheus HTTP histograms | > 1.5s | > 3s |
| Workflow queue depth | `workflow_queue_depth` / BullMQ | > 25 | > 100 |
| Oldest queued job age | BullMQ job timestamps | > 5m | > 15m |
| Workflow failure rate by connector | run status + connector metadata | > 10% over 15m | > 25% over 15m |
| Vendor page-structure failures | `VENDOR_PAGE_STRUCTURE_CHANGED` | >= 1 in 15m | >= 3 in 15m |
| MFA / auth failures | auth audit + connector MFA errors | spike > 3x baseline | sustained 10m |
| Stuck runs (heartbeat stale) | worker heartbeat | > 5m | > 15m |
| Expired approvals pending | approval sweeper metrics | > 0 for 10m | > 10 |
| Notification delivery failures | approval notification warnings | > 5% | > 20% |
| Audit chain verification failures | `/audit-events/verify` canary | any failure | any failure |
| Postgres / Redis / S3 readiness | `/health/ready` | 1 failed probe | 3 consecutive failures |

## Recommended canaries

1. Staging sandbox happy path every 15 minutes (`pnpm e2e:happy`).
2. Daily Stripe Billing and GitHub connector dry-runs against dedicated test accounts.
3. Nightly `GET /audit-events/verify` for each production organization sample.
4. Weekly backup + restore drill using `pnpm backup:postgres` and `pnpm restore:postgres --confirm`.

## On-call response

1. Check `/health` and `/health/ready`.
2. Correlate `x-request-id` / workflow run ID in logs.
3. Inspect queue depth and oldest job age.
4. If connector page-structure alerts fire, pause affected connector type and open an incident.
5. Follow `docs/incident-response-plan.md` and `docs/disaster-recovery-runbook.md`.
