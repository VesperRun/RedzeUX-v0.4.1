# Redze UX (Manifest V3)

**RedzeUX suggests. You synthesize. You decide.**

**Pro Bono Populi** — full tool · **GPL-3.0** · for the better of the people.

## Quick start

1. `chrome://extensions` → Load unpacked → this folder
2. Open any **https** page → toolbar icon → **Open Panel** → **Generate UX Snapshot**
3. **Copy Brief** or **Compare Competitors** (open competitor tabs first)

No account · no license key · no watermark.

## Architecture

| Layer | Files |
|-------|--------|
| **Core** | `dom-detector.js`, `heuristic-engine.js`, `feature-taxonomy.js` |
| **Hybrid (Application)** | `hybrid-schema.js`, `entitlements.js`, `billing-config.js` |
| **Deliverables** | `brief-builder.js`, `export-report.js`, `floating-panel.js` |

See **`HYBRID-SCHEMA.md`** · **`PRICING.md`** (historical tier notes; this build is Pro Bono Populi).

## Version

**0.4.1** — Pro Bono Populi (GPL-3.0)

## License

**This build (active):** Pro Bono Populi · **GPL-3.0**. See [`LICENSE`](LICENSE), [`licenses/GPL-3.0.txt`](licenses/GPL-3.0.txt), [`PRO-BONO-POPULI.txt`](PRO-BONO-POPULI.txt).

**Other VesperRun builds (when `PRO_BONO_POPULI` is false):** proprietary · [`LICENSE-PROPRIETARY.txt`](LICENSE-PROPRIETARY.txt).

Tier/Stripe code remains in the tree for that path — not removed.

_For the people · Local only · Always._
