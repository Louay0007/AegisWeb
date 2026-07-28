# Stripe MCP provisioning notes

Generated from the authenticated Stripe MCP account `acct_1SdWzP9kgqPlSnAw`.

## What MCP can create automatically

- Products
- Prices (Starter / Business monthly)
- Most Stripe objects exposed by the API

## What MCP cannot export

- `STRIPE_SECRET_KEY` (`sk_...`) — created only in the Dashboard API keys page
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`) — created when you add a webhook endpoint or run Stripe CLI listen

The Stripe MCP OpenAPI surface in this session does **not** expose webhook endpoint create/list operations, so the signing secret must be set manually.

## Provisioned resources

### Test mode (wired into local `.env`)

| Plan | Product | Price ID | Amount |
| --- | --- | --- | ---: |
| Starter | `prod_UvraXwzYiIjr21` | `price_1Tvzr39kgqPlSnAwgRgTE00p` | $299 / month |
| Business | `prod_UvraRnEhN13TP1` | `price_1Tvzr49kgqPlSnAwFW1ApK6C` | $999 / month |

### Live mode (created earlier via MCP; keep for production)

| Plan | Product | Price ID | Amount |
| --- | --- | --- | ---: |
| Starter | `prod_UvrWirB8mHeAK2` | `price_1Tvzn89kgqPlSnAwnIUoT3ya` | $299 / month |
| Business | `prod_UvrWRHrxQ9uc7w` | `price_1Tvzn89kgqPlSnAwmZiYS4mu` | $999 / month |

Lookup keys:

- `aegisweb_starter_monthly`
- `aegisweb_business_monthly`

## Finish local setup

1. Paste your secret key into `.env`:

```bash
# https://dashboard.stripe.com/acct_1SdWzP9kgqPlSnAw/apikeys
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_... for sandbox work
```

2. Create a webhook endpoint pointing at:

```text
https://<your-api-host>/billing/webhook
```

Listen for at least:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

3. Copy the endpoint signing secret into `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

For local development without a public URL:

```bash
stripe listen --forward-to localhost:3001/billing/webhook
```

Then copy the CLI `whsec_...` into `.env`.

## Important

These prices were created in **live mode** (`livemode: true`) because the MCP session is connected to the live Stripe account. For local testing, prefer a test-mode key and recreate the same products/prices in test mode, or toggle the MCP/account to test mode before provisioning.
