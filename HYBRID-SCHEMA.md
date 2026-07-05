# Hybrid schema

Technical contract for RedzeUX tiers. Product copy lives in **`PRICING.md`**.

## Tiers

| ID | Key prefix | Sales motion |
|----|------------|--------------|
| `free` | — | Chrome extension, no key — **full tool during early access** |
| `pro` | `RZX-PRO-*` | Stripe subscription — **Supporter** ($5/mo · $39/yr) |
| `agency` | `RZX-AGENCY-*` | Flat fee + maintenance (manual / operator-issued, not public) |

Dev keys (local only): `RZX-PRO-VESPER-DEV`, `RZX-AGENCY-VESPER-DEV`

## Capability matrix (launch generosity)

| Capability | free | pro (Supporter) | agency |
|------------|:----:|:---------------:|:------:|
| Analyze page | ✓ | ✓ | ✓ |
| Brief copy | ✓ (watermark) | ✓ | ✓ |
| Compare (5 URLs) | ✓ | ✓ | ✓ |
| Client export (.md/.txt/PDF) | ✓ (watermark) | ✓ | ✓ |
| BYOK remote AI | ✓ | ✓ | ✓ |
| Stripe billing portal | — | ✓ | — |
| White-label kit | — | — | ✓ |

Source of truth in code: `hybrid-schema.js` → `RedzeUXHybrid.CAPABILITIES`

**Supporter differentiation:** `isPaid()` removes brief/export watermark. Capabilities are otherwise identical during early access.

## Storage (extension)

| Key | Purpose |
|-----|---------|
| `redzeux_license_key` | `RZX-PRO-*` or `RZX-AGENCY-*` |
| `redzeux_license_tier` | `pro` \| `agency` after verify |
| `redzeux_license_active` | Server verify result |
| `redzeux_license_verified_at` | Cache timestamp |
| `redzeux_license_expires_at` | Subscription or maintenance end |

## Server (`stripe/`)

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/license/verify` | Returns `{ valid, tier, expiresAt, hasBillingPortal }` |
| `POST /v1/billing/portal` | Supporter / pro only (requires `stripeCustomerId`) |
| `POST /v1/license/issue` | Operator issues Agency keys (`ADMIN_SECRET`) |

License record fields: `key`, `tier`, `email`, `stripeCustomerId`, `stripeSubscriptionId`, `maintenanceExpiresAt`, `active`

## Refund policy (Supporter)

Fixed **$8 USD** environmental/handling charge on approved first-payment refunds — see `billing-config.js` → `refundPolicy.environmentalFeeUsd`. Non-negotiable; plus non-recoverable Stripe fees.

## Repo layout (hybrid)

```text
RedzeUX/
  hybrid-schema.js      ← tier constants (extension)
  entitlements.js       ← enforcement
  billing-config.js     ← Stripe Payment Link (Supporter)
  PRICING.md            ← GTM / prices
  agency/KIT.md         ← Agency buyer checklist (not public GTM)
  scripts/white-label.mjs
  stripe/               ← Supporter + Agency license server
```

## Versioning

Extension semver in `manifest.json`. Agency maintenance delivered via git tags + `CHANGELOG-MAINTENANCE.md` (future).
