# RedzeUX + Stripe (Hybrid server)

Serves **Supporter** (subscription, internal tier `pro`) and **Agency** (kit + maintenance) license tiers.

See **`../HYBRID-SCHEMA.md`** · **`../PRICING.md`**

## Endpoints

| Route | Tier | Body |
|-------|------|------|
| `POST /v1/license/verify` | all | `{ "key": "RZX-PRO-…" \| "RZX-AGENCY-…" }` |
| `POST /v1/billing/portal` | pro only | `{ "key" }` |
| `POST /v1/license/issue` | admin | `{ "tier": "agency", "email", "maintenanceYears": 1 }` |

Admin issue: `Authorization: Bearer ADMIN_SECRET`

## Issue Agency key (operator)

```bash
curl -X POST https://YOUR_DOMAIN/v1/license/issue \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tier":"agency","email":"buyer@studio.com","maintenanceYears":1}'
```

## Supporter checkout

Webhook `checkout.session.completed` → `RZX-PRO-*` + Resend email.

Stripe products: **$5/mo** and **$39/yr** (see `../hybrid-schema.js`).

Optional metadata `redzeux_tier=agency` on checkout for agency one-time products.

## Supporter refunds (operator)

Policy lives in **`../billing-config.js`** → `refundPolicy.environmentalFeeUsd`.

On approved 14-day guarantee refund:

1. Issue partial Stripe refund: `computeProRefundBreakdown(amount).netRefund`
2. Deactivate license key in your store / DB
3. Retained amount covers environmental/handling + non-recoverable Stripe fees

Payment Link / checkout copy must disclose guarantee deductions (see **`../PRICING.md`**).

## Env

See `.env.example` — `STRIPE_*`, `RESEND_*`, `ADMIN_SECRET`, `LICENSE_VERIFY_ORIGINS`.
