# RedzeUX Agency Kit

**Lane:** Hybrid schema · `agency` tier · `RZX-AGENCY-*` keys

Flat fee + annual maintenance. Sold manually until Stripe one-time product is configured.

## What the buyer gets

- White-label Chrome extension (name, icons, default export branding)
- Self-hosted `stripe/` license server on their domain
- Commercial rights for client deliverables
- **`PRICING.md`** maintenance scope: taxonomy, MV3, exports, security patches

## Operator checklist (you)

1. Run `node scripts/white-label.mjs --name "Studio Name" --support support@studio.com`
2. Issue key: `POST /v1/license/issue` with `ADMIN_SECRET` (see `stripe/README.md`)
3. Send buyer: extension zip/fork, server `.env` template, key email
4. Bill **$1,299** license + **$299/yr** maintenance (invoice or Stripe one-time + sub)

## Buyer checklist (them)

1. Deploy `stripe/` with their Stripe account (Agency keys do not require your Stripe)
2. Set `billing-config.js`: `licenseVerifyUrl` → their server
3. Paste `RZX-AGENCY-*` in Options → Save & verify
4. Options → Report branding → agency + client names
5. Deliver client exports from floating panel

## Maintenance

Agency keys include `maintenanceExpiresAt`. Verify fails after expiry until renewed.

Renewal = update server record + invoice. No automatic charge unless you add it.

## Solo source ($349 + $99/yr)

Same kit, 1 seat, no multi-seat terms — issue `RZX-AGENCY-*` with 1-year maintenance in `maintenanceExpiresAt`.

See **`PRICING.md`** · **`HYBRID-SCHEMA.md`**
