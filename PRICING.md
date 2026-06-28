# RedzeUX Pricing — Hybrid Model

**Schema:** `HYBRID-SCHEMA.md` · **Code:** `hybrid-schema.js`

**Philosophy:** Free for the people · Pro for solo pros · Agency kit for shops that white-label.

RedzeUX suggests. You synthesize. You decide.

---

## Three lanes (one product, three offers)

| Lane | Price | Buyer | Job to be done |
|------|-------|-------|----------------|
| **Free — Snapshot** | $0 | Anyone | “Is this useful on my page right now?” |
| **Pro — Teardown** | **$24/mo** or **$199/yr** | Founder, freelancer, PM | “Unlimited briefs + compare + client exports for my own work” |
| **Agency — Kit** | **$1,299** once + **$299/yr** maintenance | Studio, consultancy, dev shop | “We deliver competitive UX reads under our brand, self-hosted” |

Do **not** merge these into one confused SKU. Separate Stripe products, separate copy, separate license keys.

---

## Free (Snapshot)

**Includes**

- Analyze current page (visible UI only)
- Pattern / gap readout + advisory suggestions (local)
- 3 executive brief copies per day (watermarked)
- Floating panel on demand

**Purpose:** Instant “oh, this is useful” — distribution and Philosophia *for the people*.

**Never paywall:** Core analyze path.

---

## Pro (Teardown) — subscription

**Price (recommended launch)**

- **$24/month**
- **$199/year** (~31% off — push annual at checkout)

**Includes everything in Free, plus**

- Unlimited brief copy (clipboard)
- Compare up to 5 saved URLs + compare brief
- Branded client export: `.md`, `.txt`, print/PDF
- Optional BYOK remote AI
- Stripe Customer Portal (manage/cancel)

**Stripe setup:** Payment Link + webhook license server (see `stripe/README.md`).

**License key format:** `RZX-PRO-…` or `RZX-AGENCY-…`

**Buyer message:** *“One client export pays for months of Pro.”*

---

## Agency (Kit) — flat fee + maintenance

**Price (recommended launch)**

- **$1,299** one-time license
- **$299/year** maintenance (required for updates after year 1)

**Includes**

- White-label extension build (your agency name, icons, default export branding)
- Self-hosted license server (`stripe/`) on buyer’s domain
- Commercial use for client deliverables
- Maintenance: taxonomy updates, MV3/Chrome compatibility, export template fixes, security patches

**Not included in maintenance:** custom feature dev, unlimited support, guaranteed findings.

**License key format (future):** `RZX-AGENCY-…` or org-bound keys — manual issuance at first.

**Buyer message:** *“Own the teardown machine. Bill clients $1k+. We maintain compatibility.”*

---

## Solo source license (optional middle tier)

If Agency feels too big before you have agency customers:

| SKU | One-time | Maintenance |
|-----|----------|-------------|
| **Solo source** | **$349** | **$99/yr** |

1 seat, rebrand exports, self-host server — no multi-seat/agency terms.

---

## What we sell (honest language)

**Do sell**

- Competitive UX snapshot in 2 minutes
- Paste-ready / client-ready brief
- Local-first, visible UI only, advisory not verdicts

**Do not sell**

- “AI UX assistant”
- “Automated UX audit”
- “Guaranteed conversion lift”

---

## Implementation map (current repo)

| Capability | Free | Pro | Agency |
|------------|------|-----|--------|
| Analyze + heuristics | ✅ | ✅ | ✅ (their deploy) |
| Brief copy limit | 3/day | Unlimited | Unlimited |
| Compare | ❌ | ✅ | ✅ |
| Branded export | ❌ | ✅ | ✅ + default brand |
| Stripe subscription | — | ✅ | Buyer’s Stripe |
| Checkout email | — | ✅ | Buyer configures |
| White-label manifest | — | ❌ | Manual / future kit script |

**Next engineering (Agency lane):**

1. `RZX-AGENCY-*` entitlements + org branding defaults
2. `scripts/white-label.mjs` — agency name, icons, support email
3. Agency Stripe product (one-time + maintenance subscription) — manual or Payment Link
4. Maintenance changelog (`CHANGELOG-MAINTENANCE.md`) for annual buyers

---

## Stripe fee sanity (Pro)

On **$24/mo:** ~$23.00 net after Stripe fees.  
On **$199/yr:** ~$192.93 net — prefer annual for retention.

---

## Grandfathering

When raising Pro to **$29/mo**, keep early subscribers at **$24** via Stripe price locking.

Agency maintenance increases only with published changelog scope — never silent.

---

_For the people · Local only · Always._
