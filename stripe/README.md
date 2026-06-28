# RedzeUX + Stripe

Minimal **Application-layer** billing for Pro. Core extension logic stays local; Stripe issues keys, sends email, and hosts billing portal.

## Flow

1. Customer clicks **Upgrade with Stripe** in extension Options.
2. Stripe checkout completes.
3. Webhook issues `RZX-PRO-*` and emails the key (Resend).
4. Customer pastes key in Options → **Save & verify**.
5. Pro unlocks: compare, unlimited briefs, branded exports.
6. **Manage subscription** opens Stripe Customer Portal.

Extension heuristics are **never** sent to this server.

## 1. Stripe Dashboard

1. **Product:** RedzeUX Pro — recurring subscription.
2. **Payment Link** → copy to `billing-config.js` → `stripePaymentLink`.
3. **Customer portal:** Settings → Billing → enable portal (cancel, update payment).
4. **Success URL:** `https://YOUR_DOMAIN/success`
5. **Webhook:** `https://YOUR_DOMAIN/webhook`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

## 2. Email (Resend)

```env
RESEND_API_KEY=re_...
EMAIL_FROM=RedzeUX <billing@yourdomain.com>
```

Without Resend, keys log to server console (dev only).

## 3. Run server

```bash
cd stripe
cp .env.example .env
npm install
npm start
```

Test webhooks locally:

```bash
stripe listen --forward-to localhost:4242/webhook
```

## 4. Wire extension

`billing-config.js`:

```javascript
stripePaymentLink: 'https://buy.stripe.com/...',
licenseVerifyUrl: 'https://YOUR_DOMAIN/v1/license/verify',
// billingPortalUrl auto-derived as .../v1/billing/portal
```

Set `LICENSE_VERIFY_ORIGINS=chrome-extension://YOUR_EXTENSION_ID` in `.env`.

## Endpoints

| Route | Purpose |
|-------|---------|
| `POST /webhook` | Issue key + email |
| `POST /v1/license/verify` | Validate key + subscription |
| `POST /v1/billing/portal` | Stripe portal session URL |
| `GET /success` | Post-checkout landing |

## Security

- Never put `STRIPE_SECRET_KEY` in the extension.
- Verify/portal accept `{ key }` only — no page data.
- Dev key `RZX-PRO-VESPER-DEV` works offline in extension (not in server DB).
