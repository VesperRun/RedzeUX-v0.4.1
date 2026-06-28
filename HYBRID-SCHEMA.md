# Hybrid schema

Technical contract for RedzeUX tiers. Product copy lives in **`PRICING.md`**.

## Tiers

| ID | Key prefix | Sales motion |
|----|------------|--------------|
| `free` | — | Chrome extension, no key |
| `pro` | `RZX-PRO-*` | Stripe subscription (self-serve) |
| `agency` | `RZX-AGENCY-*` | Flat fee + maintenance (manual / operator-issued) |

Dev keys (local only): `RZX-PRO-VESPER-DEV`, `RZX-AGENCY-VESPER-DEV`

## Capability matrix

| Capability | free | pro | agency |
|------------|:----:|:---:|:------:|
| Analyze page | ✓ | ✓ | ✓ |
| Brief copy | 3/day | ∞ | ∞ |
| Compare (5 URLs) | — | ✓ | ✓ |
| Client export (.md/.txt/PDF) | — | ✓ | ✓ |
| BYOK remote AI | — | ✓ | ✓ |
| Stripe billing portal | — | ✓ | — |
| White-label kit | — | — | ✓ |

Source of truth in code: `hybrid-schema.js` → `RedzeUXHybrid.CAPABILITIES`

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
| `POST /v1/billing/portal` | Pro only (requires `stripeCustomerId`) |
| `POST /v1/license/issue` | Operator issues Agency keys (`ADMIN_SECRET`) |

License record fields: `key`, `tier`, `email`, `stripeCustomerId`, `stripeSubscriptionId`, `maintenanceExpiresAt`, `active`

## Repo layout (hybrid)

```text
RedzeUX/
  hybrid-schema.js      ← tier constants (extension)
  entitlements.js       ← enforcement
  billing-config.js     ← Stripe Payment Link (Pro)
  PRICING.md            ← GTM / prices
  agency/KIT.md         ← Agency buyer checklist
  scripts/white-label.mjs
  stripe/               ← Pro + Agency license server
```

## Versioning

Extension semver in `manifest.json`. Agency maintenance delivered via git tags + `CHANGELOG-MAINTENANCE.md` (future).
