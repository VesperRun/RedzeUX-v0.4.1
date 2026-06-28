/**
 * Hybrid license server — Pro (Stripe sub) + Agency (kit + maintenance).
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import express from 'express';
import Stripe from 'stripe';

import { sendLicenseKeyEmail } from './email.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'licenses.json');
const PORT = Number(process.env.PORT || 4242);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.error('Missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

const stripe = new Stripe(stripeSecret);
const app = express();

const TIERS = { PRO: 'pro', AGENCY: 'agency' };
const KEY_RE = /^RZX-(PRO|AGENCY)-[A-Z0-9]{8,}$/;

function loadLicenses() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { keys: {} };
  }
}

function saveLicenses(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateLicenseKey(tier = TIERS.PRO) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 12; i += 1) {
    suffix += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  const prefix = tier === TIERS.AGENCY ? 'RZX-AGENCY' : 'RZX-PRO';
  return `${prefix}-${suffix}`;
}

function normalizeKey(key) {
  return String(key || '')
    .trim()
    .toUpperCase();
}

function tierFromKey(key) {
  const normalized = normalizeKey(key);
  if (normalized.startsWith('RZX-AGENCY-')) return TIERS.AGENCY;
  if (normalized.startsWith('RZX-PRO-')) return TIERS.PRO;
  return null;
}

function upsertLicense(record) {
  const data = loadLicenses();
  data.keys[record.key] = record;
  saveLicenses(data);
  return record;
}

function getLicense(key) {
  const data = loadLicenses();
  return data.keys[normalizeKey(key)] || null;
}

function isAgencyActive(license) {
  if (license.tier !== TIERS.AGENCY) return true;
  if (!license.maintenanceExpiresAt) return license.active !== false;
  return new Date(license.maintenanceExpiresAt).getTime() > Date.now();
}

async function refreshSubscriptionStatus(license) {
  if (license.tier === TIERS.AGENCY) {
    const active = isAgencyActive(license);
    license.active = active;
    upsertLicense(license);
    return active;
  }

  if (!license.stripeSubscriptionId) {
    return license.active !== false;
  }

  try {
    const sub = await stripe.subscriptions.retrieve(license.stripeSubscriptionId);
    const active = ['active', 'trialing'].includes(sub.status);
    license.active = active;
    license.currentPeriodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : license.currentPeriodEnd;
    upsertLicense(license);
    return active;
  } catch (error) {
    console.error('Stripe subscription refresh failed:', error.message);
    return license.active !== false;
  }
}

function licenseExpiresAt(license) {
  if (license.tier === TIERS.AGENCY) {
    return license.maintenanceExpiresAt || null;
  }
  return license.currentPeriodEnd || null;
}

const verifyOrigins = (process.env.LICENSE_VERIFY_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

function corsGate(req, res, next) {
  if (verifyOrigins.length === 0) {
    return next();
  }
  const origin = req.headers.origin || '';
  if (verifyOrigins.includes(origin) || verifyOrigins.includes('*')) {
    return next();
  }
  return res.status(403).json({ valid: false, ok: false, error: 'origin_not_allowed' });
}

function adminGate(req, res, next) {
  if (!ADMIN_SECRET) {
    return res.status(503).json({ ok: false, error: 'admin_not_configured' });
  }
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'redzeux-hybrid-license', schema: 'free|pro|agency' });
});

app.get('/success', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>RedzeUX Pro</title></head>
<body style="font-family:system-ui;max-width:520px;margin:40px auto;padding:0 16px;">
  <h1>RedzeUX Pro</h1>
  <p>Check your email for your <code>RZX-PRO-…</code> license key.</p>
  <p>Extension → <strong>Options</strong> → paste key → <strong>Save &amp; verify</strong>.</p>
</body></html>`);
});

app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET not set');
      }
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (error) {
      console.error('Webhook signature error:', error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email || null;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const metaTier = session.metadata?.redzeux_tier;
        const tier = metaTier === TIERS.AGENCY ? TIERS.AGENCY : TIERS.PRO;

        const key = generateLicenseKey(tier);
        const record = {
          key,
          tier,
          email,
          stripeCustomerId: customerId || null,
          stripeSubscriptionId: tier === TIERS.PRO ? subscriptionId : null,
          stripeSessionId: session.id,
          active: true,
          createdAt: new Date().toISOString(),
          currentPeriodEnd: null,
          maintenanceExpiresAt:
            tier === TIERS.AGENCY
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              : null
        };

        if (tier === TIERS.PRO && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          record.currentPeriodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
        }

        upsertLicense(record);
        console.log(`Issued ${tier} license ${key} for ${email || 'unknown'}`);
        await sendLicenseKeyEmail(email, key, tier);
      }

      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        const data = loadLicenses();
        Object.values(data.keys).forEach((license) => {
          if (license.stripeSubscriptionId === sub.id) {
            license.active = false;
            license.deactivatedAt = new Date().toISOString();
            upsertLicense(license);
          }
        });
      }

      if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object;
        const data = loadLicenses();
        Object.values(data.keys).forEach((license) => {
          if (license.stripeSubscriptionId === sub.id) {
            license.active = ['active', 'trialing'].includes(sub.status);
            license.currentPeriodEnd = sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : license.currentPeriodEnd;
            upsertLicense(license);
          }
        });
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      return res.status(500).json({ error: 'handler_failed' });
    }

    res.json({ received: true });
  }
);

app.use(express.json());

app.post('/v1/license/verify', corsGate, async (req, res) => {
  const key = normalizeKey(req.body?.key);
  if (!key || !KEY_RE.test(key)) {
    return res.json({ valid: false, error: 'invalid_format' });
  }

  const license = getLicense(key);
  if (!license) {
    return res.json({ valid: false, error: 'not_found' });
  }

  const active = await refreshSubscriptionStatus(license);
  if (!active) {
    return res.json({ valid: false, error: 'inactive' });
  }

  return res.json({
    valid: true,
    tier: license.tier || tierFromKey(key) || TIERS.PRO,
    expiresAt: licenseExpiresAt(license),
    hasBillingPortal: license.tier === TIERS.PRO && Boolean(license.stripeCustomerId)
  });
});

app.post('/v1/billing/portal', corsGate, async (req, res) => {
  const key = normalizeKey(req.body?.key);
  const license = getLicense(key);

  if (!license) {
    return res.json({ ok: false, error: 'not_found' });
  }

  if (license.tier !== TIERS.PRO) {
    return res.json({ ok: false, error: 'pro_only' });
  }

  if (!license.stripeCustomerId) {
    return res.json({ ok: false, error: 'no_stripe_customer' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: license.stripeCustomerId,
      return_url: `${PUBLIC_BASE_URL}/success`
    });
    return res.json({ ok: true, url: session.url });
  } catch (error) {
    return res.json({ ok: false, error: 'portal_failed', message: error.message });
  }
});

/** Operator: issue Agency (or Pro) keys — Authorization: Bearer ADMIN_SECRET */
app.post('/v1/license/issue', adminGate, (req, res) => {
  const tier = req.body?.tier === TIERS.AGENCY ? TIERS.AGENCY : TIERS.PRO;
  const email = req.body?.email || null;
  const maintenanceYears = Number(req.body?.maintenanceYears) || 1;

  const key = generateLicenseKey(tier);
  const record = {
    key,
    tier,
    email,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    active: true,
    createdAt: new Date().toISOString(),
    currentPeriodEnd: null,
    maintenanceExpiresAt:
      tier === TIERS.AGENCY
        ? new Date(Date.now() + maintenanceYears * 365 * 24 * 60 * 60 * 1000).toISOString()
        : null
  };

  upsertLicense(record);
  console.log(`Operator issued ${tier} key ${key}`);
  return res.json({ ok: true, key, tier, maintenanceExpiresAt: record.maintenanceExpiresAt });
});

app.listen(PORT, () => {
  console.log(`RedzeUX hybrid license server — ${PUBLIC_BASE_URL}`);
  console.log(`Verify: POST /v1/license/verify`);
  console.log(`Portal: POST /v1/billing/portal (pro only)`);
  console.log(`Issue:  POST /v1/license/issue (admin)`);
});
