# Stripe Billing Setup

Use Stripe test mode first. Switch to live mode only after checkout, portal, and webhooks are verified in staging.

## 1. Create Products and Prices

1. Open https://dashboard.stripe.com/test/products.
2. Click **Add product**.
3. Create **AegisWeb Starter** with a recurring monthly price.
4. Copy the generated price ID. It starts with `price_`.
5. Create **AegisWeb Business** with a recurring monthly price.
6. Copy that price ID too.

Set these environment variables on the API service:

```bash
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
```

## 2. Get the Secret Key

1. Open https://dashboard.stripe.com/test/apikeys.
2. Copy the **Secret key**. In test mode it starts with `sk_test_`.
3. Set it on the API service:

```bash
STRIPE_SECRET_KEY=sk_test_...
```

Never put Stripe secret keys in frontend `NEXT_PUBLIC_*` variables.

## 3. Configure Redirect URLs

Use your dashboard URL in staging/production:

```bash
STRIPE_SUCCESS_URL=https://app.aegisweb.com/app/settings?billing=success
STRIPE_CANCEL_URL=https://app.aegisweb.com/app/settings?billing=cancelled
```

For local development:

```bash
STRIPE_SUCCESS_URL=http://localhost:3000/app/settings?billing=success
STRIPE_CANCEL_URL=http://localhost:3000/app/settings?billing=cancelled
```

## 4. Configure the Webhook

1. Open https://dashboard.stripe.com/test/webhooks.
2. Click **Add endpoint**.
3. Use this endpoint URL:

```text
https://api.aegisweb.com/billing/webhook
```

For staging, use the staging API URL.

4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Save the endpoint.
6. Click the endpoint and copy **Signing secret**. It starts with `whsec_`.
7. Set it on the API service:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 5. Test Locally With Stripe CLI

Install Stripe CLI: https://docs.stripe.com/stripe-cli.

Login:

```bash
stripe login
```

Forward webhooks to the local API:

```bash
stripe listen --forward-to localhost:3001/billing/webhook
```

The CLI prints a local `whsec_...` value. Use that value for `STRIPE_WEBHOOK_SECRET` locally.

## 6. Verify the Flow

1. Start API and web.
2. Sign in as an OWNER.
3. Open `/app/settings`.
4. In **Billing**, click **Start Starter** or **Start Business**.
5. Use Stripe test card:

```text
4242 4242 4242 4242
Any future expiry date
Any CVC
Any postal code
```

6. After checkout, return to settings.
7. Confirm Stripe webhook updated the workspace billing fields.
8. Click **Open Stripe portal** and verify the customer portal opens.

## Required Production Variables

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
STRIPE_SUCCESS_URL=https://app.aegisweb.com/app/settings?billing=success
STRIPE_CANCEL_URL=https://app.aegisweb.com/app/settings?billing=cancelled
```

## Safety Notes

- Use test mode in development and staging.
- Use live mode only in production.
- The webhook must use the exact raw request body; the API is configured with Nest raw-body support.
- Checkout and portal endpoints are OWNER-only.
- Webhook updates are idempotent and keyed by Stripe customer/subscription IDs.
