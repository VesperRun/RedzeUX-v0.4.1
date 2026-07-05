# RedzeUX Pricing — Launch generosity

**Schema:** `HYBRID-SCHEMA.md` · **Code:** `hybrid-schema.js`

**Philosophy:** Full tool free during early access · optional Supporter tier · Agency kit by invitation only.

RedzeUX suggests. You synthesize. You decide.

---

## Two public lanes

| Lane | Price | Buyer | Job to be done |
|------|-------|-------|----------------|
| **Free — Early Access** | **$0** | UX consultants, PMs, founders | “Run a competitive snapshot on a real page — no signup, no card” |
| **Supporter** | **$5/mo** or **$39/yr** | People who want to chip in | “Same tool, no brief watermark — fund continued development” |

**Not public:** Agency white-label kit — contact operator only.

---

## Free (Early Access)

**Includes (generous — for validation, not upsell traps)**

- Analyze current page (visible UI only)
- Pattern / gap readout + advisory suggestions (local)
- **Unlimited** brief copies (clipboard) — small footer watermark
- Compare up to 5 saved URLs + compare brief
- Client export: `.md`, `.txt`, print/PDF — watermark on free tier
- Optional BYOK remote AI
- Floating panel on demand

**Purpose:** Proof, pilots, testimonials. Zero friction.

**Never paywall:** Core analyze path.

---

## Supporter — optional subscription

**Price (launch)**

- **$5/month**
- **$39/year** (~35% off vs monthly — push annual at checkout)

**Same capabilities as Free, plus**

- **No watermark** on brief copy and exports
- Supporter badge in Options
- Stripe Customer Portal (manage/cancel)

**Stripe setup:** Payment Link + webhook license server (see `stripe/README.md`).

**License key format:** `RZX-PRO-…` (internal tier id remains `pro`)

**Buyer message:** *“Optional — chip in if RedzeUX saved you an hour on a client comp.”*

### Supporter money-back guarantee (14 days)

Try Supporter on real work. If it is not worth keeping within **14 days** of your **first Supporter payment**, contact support for an approved refund.

**Refund amount — no exceptions on deductions**

```text
Refund = First Supporter payment
       − Environmental / handling charge ($8 USD — operator-set, non-negotiable)
       − Non-recoverable Stripe processing fees on that payment
```

- **Environmental / handling charge** — `billing-config.js` → `refundPolicy.environmentalFeeUsd` (**$8**). Covers operator labor, handling, and infrastructure when processing a return.
- **Stripe fees** — payment processors typically do not return their fee when we refund you; that cost is deducted from the refund total.
- **License** — revoked on refund. One cash refund per customer unless agreed otherwise.
- **Agency kit** — not covered by this self-serve guarantee; manual kit terms apply.

**Examples (default $8 environmental fee — mandatory)**

| First payment | ~Stripe fee | ~You receive back |
|---------------|-------------|-------------------|
| $5 (monthly) | ~$0.45 | **$0.00** |
| $39 (annual) | ~$1.43 | ~$29.57 |

On **$5/mo**, the environmental/handling charge (capped at payment amount) retains the **full first payment** on an approved refund — that is intentional and not waived. On annual, the full **$8** environmental fee applies. Adjust list price only by raising Supporter subscription, never by reducing the environmental fee.

Must match checkout and store copy.

---

## Agency (Kit) — not public

Sold manually when a studio asks. Not listed in extension UI or store copy at launch.

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

| Capability | Free (early access) | Supporter | Agency |
|------------|:-------------------:|:---------:|:------:|
| Analyze + heuristics | ✅ | ✅ | ✅ (their deploy) |
| Brief copy | ✅ (watermark) | ✅ | ✅ |
| Compare | ✅ | ✅ | ✅ |
| Branded export | ✅ (watermark) | ✅ clean | ✅ + default brand |
| BYOK remote AI | ✅ | ✅ | ✅ |
| Stripe subscription | — | ✅ | Buyer’s Stripe |
| White-label manifest | — | ❌ | Manual / future kit script |

Source of truth: `hybrid-schema.js` → `RedzeUXHybrid.CAPABILITIES`

---

## Stripe fee sanity (Supporter)

On **$5/mo:** ~$4.55 net after Stripe fees.  
On **$39/yr:** ~$37.57 net — prefer annual for retention.

---

## Grandfathering

When raising Supporter pricing, keep early subscribers on launch rates via Stripe price locking.

---

_For the people · Local only · Always._
