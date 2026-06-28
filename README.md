# Redze UX (Manifest V3)

**RedzeUX suggests. You synthesize. You decide.**

Privacy-first, local-first Chrome extension for **competitive UX snapshots** and **paste-ready executive briefs** — from visible page UI only, advisory not verdicts.

Aligned with **Philosophia Vesperi** · Galvenais Rule · `ALLOWANCES-LOG.md`.

## One-line pitch

Competitive UX snapshots in 2 minutes, from the live page, no analytics install.

## Tiers

| Tier | Includes |
|------|----------|
| **Free (Snapshot)** | Analyze page · pattern/gap readout · 3 brief copies/day |
| **Pro (Teardown)** | Unlimited briefs · compare · branded .md/.txt/PDF export · BYOK AI · Stripe portal |

Unlock Pro in **Options** — **Upgrade with Stripe**, then paste your `RZX-PRO-*` key from checkout.

### Stripe setup (operator)

1. Edit `billing-config.js` — Payment Link + verify URL  
2. Run minimal server: `stripe/README.md`  
3. Webhook issues keys; extension verifies via POST (no browsing data sent)

Dev key (offline testing): `RZX-PRO-VESPER-DEV` — see `ALLOWANCES-LOG.md`.

## Quick start

1. Open `chrome://extensions` → **Developer mode** → **Load unpacked**
2. Select this folder: `RedzeUX`
3. Open any site → click extension → **Open Panel** or **Analyze This Page**
4. **Options & Pro** for license key and optional remote AI

## Philosophy (simple outside, depth inside)

- **Popup:** open panel + analyze — one primary action
- **Floating panel:** analyze, brief copy, compare + client export (Pro)
- **Options:** Stripe checkout, portal, Pro key, report branding, BYOK AI

Footer truth: **For the people · Local only · Always.**

## Architecture

- `dom-detector.js` / `heuristic-engine.js` — **Core** observable facts → bounded heuristics
- `brief-builder.js` — executive brief (lead deliverable)
- `entitlements.js` — **Application** local tier gate (no accounts)
- `floating-panel.js` — in-page UI
- `comparison-manager.js` / `comparison-benchmark.js` — Pro compare workflow
- `export-report.js` — Pro branded .md / .txt / print-PDF
- `ai-wrapper.js` — local suggestions; optional Pro BYOK remote

## Permissions

`storage` · `activeTab` · `tabs` · `scripting` · `<all_urls>` — see allowance A-001 in `ALLOWANCES-LOG.md`.

## Legal

- `privacy-policy.md`
- `terms-of-service.md`
- `ai-disclaimer.md`

Replace support contact before Store listing (allowance A-010).

## Version

**0.4.0** — checkout email, Stripe portal, branded client exports
