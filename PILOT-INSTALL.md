# RedzeUX — Pilot install (sideload)

Early access only. **Not on the Chrome Web Store** until StellarTech Conceptual LLC is filed.

RedzeUX is a **local-first** Chrome extension: visible UI pattern detection, competitor compare, and paste-ready briefs. No account required for pilots.

**Support:** RedzeUX@proton.me

---

## What you need

- **Google Chrome** (or Chromium) on desktop — Windows, macOS, or Linux
- The **RedzeUX project folder** (unzipped), with `manifest.json` at the top level
- **Developer mode** enabled in Chrome (one-time, for sideload only)

---

## Install (load unpacked)

1. Get the extension files from the operator (zip or git clone). Unzip if needed.
2. Open **`chrome://extensions`** in Chrome.
3. Turn **Developer mode** on (top-right toggle).
4. Click **Load unpacked**.
5. Select the **RedzeUX folder** — the one that contains `manifest.json`, not a parent directory.
6. Confirm **Redze UX** appears in the list and is **Enabled**.

Optional: click the puzzle icon in the toolbar → pin **Redze UX** for quick access.

---

## First run (2 minutes)

1. Open any **https** website you want to analyze (e.g. a client or competitor homepage).
2. Click the **Redze UX** toolbar icon → **Open Panel** (or **Generate UX Snapshot**).
3. Use the floating panel:
   - **Generate UX Snapshot** — patterns, gaps, heuristics for the current page
   - **Copy Brief** — paste-ready markdown for Slack, Notion, or a doc
   - **Compare Competitors** — add competitor URLs, open each site in its **own tab**, then Compare (this page counts automatically)

**Compare tip:** Open each competitor in a tab and **click that tab once** so the page loads before comparing. Any page on the domain works (not just the homepage).

---

## Options

Open from the popup → **Options & licenses**, or **`chrome://extensions`** → Redze UX → **Details** → **Extension options**.

During early-access pilots, the **full tool is unlocked**. Optional **Supporter** tier (when Stripe is live) removes brief watermarks only — same features.

Optional **remote AI (BYOK):** off by default; local heuristic suggestions only unless you configure an endpoint and key.

---

## Updates during the pilot

When the operator sends a new build:

1. Replace the project folder (or `git pull` if you cloned).
2. Go to **`chrome://extensions`**.
3. Find **Redze UX** → click **Reload** (circular arrow).

You do **not** need to remove and re-add unless the operator says so.

---

## Uninstall

`chrome://extensions` → Redze UX → **Remove**.

Stored data (comparison URLs, settings) is local to your browser profile.

---

## Privacy (short)

Analysis runs **in your browser** on **visible UI only**. RedzeUX does not upload raw HTML by default. See **`privacy-policy.md`** in the project folder.

---

## Pilot feedback

Please reply to **RedzeUX@proton.me** with:

1. What you analyzed (site type / use case)
2. What saved time vs. your usual comp workflow
3. What confused you or felt missing

Thank you for testing RedzeUX early access.

_For the people · Local only · Always._
