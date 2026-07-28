# Production-like local stack — workflow test guide

Use this when you want Dockerized services running like production (`NODE_ENV=production`, HTTPS edge, Stripe test mode, seeded demo org), without fighting other projects’ host ports.

## One-time setup

```bash
# 1) Generate production-grade .env.prodtest (keeps your Stripe test keys)
pnpm prodtest:env

# 2) Map local hostnames (needs sudo once — required for the browser)
sudo sh -c "grep -q 'app.aegisweb.local' /etc/hosts || echo '127.0.0.1 app.aegisweb.local api.aegisweb.local sandbox.aegisweb.local mail.aegisweb.local minio.aegisweb.local grafana.aegisweb.local' >> /etc/hosts"
```

Without `/etc/hosts`, containers still run, but the browser cannot resolve `*.aegisweb.local`. CLI smoke tests can use:

```bash
curl -sk --resolve api.aegisweb.local:443:127.0.0.1 https://api.aegisweb.local/health/ready
```

## Start / stop

```bash
pnpm prodtest:up      # build + start
pnpm prodtest:status  # HTTPS health checks
pnpm prodtest:logs    # follow all logs
pnpm prodtest:down    # stop
```

First build takes several minutes (API, worker with Playwright, web).

## Trust the local HTTPS cert

Caddy uses an internal CA. On first visit, the browser will warn.

- Chrome/Edge: Advanced → Proceed to `app.aegisweb.local`
- Or install Caddy’s local root CA from the `caddy` volume / container (`/data/caddy/pki/authorities/local/root.crt`)

## URLs

| Surface | URL |
| --- | --- |
| Dashboard | https://app.aegisweb.local |
| API ready | https://api.aegisweb.local/health/ready |
| Vendor sandbox | https://sandbox.aegisweb.local |
| Mailpit | https://mail.aegisweb.local |
| Grafana | https://grafana.aegisweb.local |

## Demo login (seeded)

Password for all demo users: `Password123!`

| Role | Email |
| --- | --- |
| Owner | `founder@northstarlabs.dev` |
| Approver | `finance@northstarlabs.dev` |
| Auditor | `auditor@northstarlabs.dev` |
| Developer | `dev@northstarlabs.dev` |

## What the seed includes

- Org **Northstar Labs** (`business` plan, billing email set)
- Agents: Procurement Bot, Invoice Collector, Risky Admin Bot, Legacy Spend Bot
- Sandbox vendors: Acme, Nimbus, Atlas, PayrollPro (flagship browser workflows)
- Connector vendors: **Stripe Billing** + **GitHub Organization** (Phase 2 types; need real portal credentials to execute live)
- Policies, credentials, workflows, historical runs/approvals/receipts/audit chain
- One **pending** Acme downgrade approval (expires in 7 days)

## Workflow A — Flagship approval path (sandbox)

1. Open https://app.aegisweb.local/login as `founder@northstarlabs.dev`
2. Go to **Runs** → **Start workflow** → **Acme Downgrade Request**
3. Confirm agent/vendor/credential → **Start run**
4. Wait until status is **Waiting for approval** (worker logs: `pnpm prodtest:logs worker`)
5. Open https://mail.aegisweb.local and confirm the approval email (optional)
6. Log in as `finance@northstarlabs.dev` → **Approvals** → open the request
7. Review screenshot/summary → **Approve**
8. Confirm run moves to **Completed** and a **Receipt** appears
9. Open **Audit** → export JSON / verify hash chain

Automated version (from host, stack must be healthy):

```bash
E2E_WEB_URL=https://app.aegisweb.local \
E2E_API_URL=https://api.aegisweb.local \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
pnpm e2e:happy
```

(`NODE_TLS_REJECT_UNAUTHORIZED=0` is only for the local Caddy internal cert.)

## Workflow B — Invoice download (no approval)

1. Start **Acme Invoice Download**
2. Expect **Completed** with invoice/screenshot evidence on the receipt

## Workflow C — Stripe SaaS billing (AegisWeb subscription)

1. As owner, open **Settings → Billing** (API: `GET /billing`)
2. Start Checkout for Starter or Business (Stripe **test** mode)
3. Pay with test card `4242 4242 4242 4242`
4. For webhooks locally, either:
   - Run Stripe CLI against the published API through Caddy:

```bash
stripe listen --forward-to https://api.aegisweb.local/billing/webhook
```

   - Then copy the CLI `whsec_...` into `.env.prodtest` as `STRIPE_WEBHOOK_SECRET` and recreate the API container:

```bash
pnpm prodtest:env   # keeps other secrets; edit whsec if needed
docker compose --env-file .env.prodtest -f infra/docker-compose.prodtest.yml up -d api
```

5. Confirm org subscription fields update after `checkout.session.completed`

## Workflow D — MFA + step-up

1. As owner, **Settings → Security** → enroll MFA
2. Log out / log in with TOTP
3. Edit org settings or create a credential — confirm step-up password/TOTP prompt

## Workflow E — Real connectors (optional)

Seeded **Stripe Billing** / **GitHub** vendors are typed correctly but use placeholder passwords.

1. Replace credential secrets in the UI with real test-account credentials (+ TOTP if needed)
2. Start a supported workflow against that vendor
3. Expect fail-closed errors if selectors/MFA cannot complete

## Ops checks

```bash
pnpm prodtest:status
docker compose --env-file .env.prodtest -f infra/docker-compose.prodtest.yml ps
curl -k https://api.aegisweb.local/metrics | head
```

## Reset seed

```bash
pnpm prodtest:seed
```

This re-runs migrate + seed inside the migrate service (demo org is replaced).

## Notes

- Host ports **80/443** are used by Caddy. Postgres/Redis/MinIO stay on the Docker network only (avoids clashes with other local stacks).
- `.env.prodtest` is gitignored. Never commit it.
- This is **production-mode configuration with Stripe test keys**, not a live customer deployment.
- Rotate the Stripe test secret if it was pasted into chat earlier.
