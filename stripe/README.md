# RedzeUX + Stripe (Hybrid server)

Serves **Pro** (subscription) and **Agency** (kit + maintenance) license tiers.

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

## Pro checkout

Webhook `checkout.session.completed` → `RZX-PRO-*` + Resend email.

Optional metadata `redzeux_tier=agency` on checkout for agency one-time products.

## Env

See `.env.example` — `STRIPE_*`, `RESEND_*`, `ADMIN_SECRET`, `LICENSE_VERIFY_ORIGINS`.
