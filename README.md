# Redze UX (Manifest V3)

**RedzeUX suggests. You synthesize. You decide.**

**VesperRun · proprietary · local-first** — full tool during early access; no account, no watermark (`PRE_LAUNCH_GATES_OPEN`).

## Quick start

1. `chrome://extensions` → Load unpacked → this folder
2. Open any **https** page → toolbar icon → **Open Panel** → **Generate UX Snapshot**
3. **Copy Brief** or **Compare Competitors** (open competitor tabs first)

No account · no license key · no watermark (early access).

## Architecture

| Layer | Files |
|-------|--------|
| **Core** | `dom-detector.js`, `heuristic-engine.js`, `feature-taxonomy.js` |
| **Hybrid (Application)** | `hybrid-schema.js`, `entitlements.js`, `billing-config.js` |
| **Deliverables** | `brief-builder.js`, `export-report.js`, `floating-panel.js` |

See **`HYBRID-SCHEMA.md`** · **`PRICING.md`** (tier notes; dormant until gates close).

## Version

**0.4.1** — proprietary (VesperRun).

## License

**This build (active):** **proprietary · VesperRun · all rights reserved.** See [`LICENSE`](LICENSE) and [`LICENSE-PROPRIETARY.txt`](LICENSE-PROPRIETARY.txt).

Pro Bono Populi / GPL-3 is **not** active on new commits (see [`PRO-BONO-POPULI.txt`](PRO-BONO-POPULI.txt)). `licenses/GPL-3.0.txt` is reference only and applies to **prior public GPL releases** already published — not a grant on new proprietary work.

**Public repo note:** If this GitHub repo was public under GPL, forks and clones of **older commits** may remain GPL-3.0. New commits after 2026-09-20 are proprietary. Consider making the repo **private** or distributing **Store-only binaries** before VP if you want to limit further source exposure — operator decision.

Tier/Stripe code remains in the tree — not removed.

Support: `RedzeUX@proton.me`

_For the people · Local only · Always._
