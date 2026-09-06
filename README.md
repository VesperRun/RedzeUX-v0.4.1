# Redze UX (Manifest V3) — Hybrid

**RedzeUX suggests. You synthesize. You decide.**

Three lanes — one engine. See **`HYBRID-SCHEMA.md`** · **`PRICING.md`**.

| Lane | Price | Key |
|------|-------|-----|
| **Free (Early Access)** | $0 | — |
| **Supporter** | $5/mo · $39/yr | `RZX-PRO-*` |
| **Agency (Kit)** | $1,299 + $299/yr | `RZX-AGENCY-*` |

## Quick start

**Pilots (sideload):** see **`PILOT-INSTALL.md`**

1. `chrome://extensions` → Load unpacked → this folder
2. Open any **https** page → toolbar icon → **Open Panel** → **Generate UX Snapshot**
3. **Copy Brief** or **Compare Competitors** (open competitor tabs first)

During early-access pilots the **full tool is unlocked** — no license key required.

## Architecture

| Layer | Files |
|-------|--------|
| **Core** | `dom-detector.js`, `heuristic-engine.js`, `feature-taxonomy.js` |
| **Hybrid (Application)** | `hybrid-schema.js`, `entitlements.js`, `billing-config.js` |
| **Deliverables** | `brief-builder.js`, `export-report.js`, `floating-panel.js` |
| **Pro server** | `stripe/` |
| **Agency kit** | `agency/KIT.md`, `scripts/white-label.mjs` |

## Version

**0.4.1** — Early access pilots (full tool unlocked)

## License

Copyright (c) 2026 VesperRun. All rights reserved.

RedzeUX is **not** free software. See [`LICENSE`](LICENSE). Chrome Web Store use and paid keys (Pro / Agency) are product access. They do not grant a right to fork or republish the code or brand.

_For the people · Local only · Always._
