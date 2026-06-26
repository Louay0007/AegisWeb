# Load Test Targets

Pilot launch targets:

- API health/readiness: at least 50 requests per second with default `pnpm load:api` settings.
- Workflow-facing endpoints: p95 latency at or below 500ms with default `pnpm load:workflow` settings.
- Run load tests against staging before each pilot release.
- Archive command output or `.qa-artifacts` with the launch checklist evidence.
