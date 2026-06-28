# RedzeUX Allowances Log

Collective record of **Application-layer** concessions that do **not** pollute Core (detector → heuristics → bounded advisory).  
Governed by **Philosophia Vesperi** · Prisma Narcissi · Galvenais Rule.

**Status:** ACTIVE · Enhanced MVP (2026-06-28)  
**Rule:** If an allowance touches observable mechanics, scoring logic, or surveillance — **reject** and relocate to Filter or Application only.

---

## Active allowances

| ID | Allowance | Tier | Why it is not Core pollution | Review by |
|----|-----------|------|------------------------------|-----------|
| A-001 | `<all_urls>` host permission | Application | Injection surface for user-triggered analysis only; no remote rule feed | Store review / v0.4 |
| A-002 | Offline Pro license key (`RZX-PRO-*` pattern) | Application | Revenue gate; does not change heuristics or detection | First paid customer |
| A-003 | Dev unlock key `RZX-PRO-VESPER-DEV` (local only) | Application | Operator testing; documented here, not marketed | Ship |
| A-004 | Free tier: **3** executive brief copies / day | Application | Generous “for the people” hook; build notes said 1/day — revisit after validation | v0.4 |
| A-005 | Free brief footer watermark | Application | Honest upsell line; Core brief content unchanged | v0.4 |
| A-006 | Compare + compare-brief gated to Pro | Application | Deliverable monetization; analyze stays free | v0.4 |
| A-007 | Remote BYOK AI gated to Pro | Application | Optional layer; local fallback always available | v0.4 |
| A-008 | Internal `ObserveUX*` / `OBSERVEUX_*` code names | Private canon | §IX public vs private naming; user sees “Redze UX” only | Rename sprint |
| A-009 | Generated PNG icons (not final brand) | Application | Store-ready minimum; not product identity | Brand pass |
| A-010 | Support contact `support@redzeux.local` placeholder | Application | Replace before public Store listing | Pre-Store |
| A-011 | Stripe webhook + `/v1/license/verify` (minimal server in `stripe/`) | Application | Revenue without Core pollution; secrets stay on server | First paid customer |
| A-012 | Offline pattern fallback when `licenseVerifyUrl` empty | Application | Dev / pre-Stripe testing | Until verify URL live |
| A-014 | Resend checkout email (key only, no DOM) | Application | Fulfillment; optional until RESEND_API_KEY set | Production |
| A-015 | Stripe Customer Portal via `/v1/billing/portal` | Application | Subscription management; Stripe-hosted | Production |
| A-016 | Branded export (.md / .txt / print-PDF) Pro-gated | Application | Client deliverable; Core brief unchanged | v0.4 |
| A-017 | Hybrid pricing (Free / Pro sub / Agency kit) | Application | Documented in PRICING.md; Agency sold manual at first | GTM |

---

## Rejected (would pollute Core or doctrine)

| Proposal | Why rejected |
|----------|--------------|
| Auto-run analyze on every page load | Violates consent (Galvenais III) |
| Remote heuristic / taxonomy feeds | Violates local-by-default (§VI.4) |
| “AI detected UX failure” verdict language | Violates restraint (§VI.3) |
| Merge Aletheia clutter removal | Violates one product one truth (§VI.5) |
| Server-side URL / history collection | Violates minimization + no surveillance |

---

## Enhanced MVP changes (this pass)

1. **Popup:** one primary action — open panel (simple outside, depth inside panel + Options).
2. **Footer doctrine:** “For the people · Local only · Always.”
3. **Entitlements module:** local tier without accounts or telemetry.
4. **Options page:** Pro key, BYOK AI, plain tier disclosure.
5. **Free forever:** analyze page, visible pattern readout, advisory suggestions (local).
6. **Pro:** unlimited brief copy, compare matrix, compare brief, BYOK remote AI.

---

## Changelog

| Date | Entry |
|------|-------|
| 2026-06-28 | v0.4.1 — Hybrid schema (`hybrid-schema.js`), Agency keys, kit + white-label script |
| 2026-06-28 | v0.4.0 — checkout email, billing portal, branded exports |
| 2026-06-28 | Stripe Payment Link + webhook license server + verify API (v0.3.1) |
| 2026-06-28 | Initial log + enhanced MVP entitlements (v0.3.0) |

---

_RedzeUX suggests. You synthesize. You decide._
