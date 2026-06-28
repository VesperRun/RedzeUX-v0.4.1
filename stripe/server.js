/**
 * Minimal Stripe → RedzeUX license server (Application layer only).
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

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.error('Missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

const stripe = new Stripe(stripeSecret);
const app = express();

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

function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 12; i += 1) {
    suffix += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return `RZX-PRO-${suffix}`;
}

function normalizeKey(key) {
  return String(key || '')
    .trim()
    .toUpperCase();
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

async function refreshSubscriptionStatus(license) {
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
  return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'redzeux-stripe-license', version: '0.2.0' });
});

app.get('/success', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>RedzeUX Pro</title></head>
<body style="font-family:system-ui;max-width:520px;margin:40px auto;padding:0 16px;">
  <h1>RedzeUX Pro</h1>
  <p>Thank you. Check your email for your <code>RZX-PRO-…</code> license key.</p>
  <p>Open the RedzeUX extension → <strong>Options &amp; Pro</strong> → paste key → <strong>Save &amp; verify</strong>.</p>
  <p><em>RedzeUX suggests. You synthesize. You decide.</em></p>
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

        const key = generateLicenseKey();
        upsertLicense({
          key,
          email,
          stripeCustomerId: customerId || null,
          stripeSubscriptionId: subscriptionId,
          stripeSessionId: session.id,
          active: true,
          createdAt: new Date().toISOString(),
          currentPeriodEnd: null
        });

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const license = getLicense(key);
          license.currentPeriodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          upsertLicense(license);
        }

        console.log(`Issued license ${key} for ${email || 'unknown email'}`);
        await sendLicenseKeyEmail(email, key);
      }

      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        const data = loadLicenses();
        Object.values(data.keys).forEach((license) => {
          if (license.stripeSubscriptionId === sub.id) {
            license.active = false;
            license.deactivatedAt = new Date().toISOString();
            upsertLicense(license);
            console.log(`Deactivated license ${license.key}`);
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
  if (!key || !/^RZX-PRO-[A-Z0-9]{8,}$/.test(key)) {
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
    tier: 'pro',
    expiresAt: license.currentPeriodEnd || null,
    hasBillingPortal: Boolean(license.stripeCustomerId)
  });
});

app.post('/v1/billing/portal', corsGate, async (req, res) => {
  const key = normalizeKey(req.body?.key);
  const license = getLicense(key);

  if (!license) {
    return res.json({ ok: false, error: 'not_found' });
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
    console.error('Billing portal error:', error.message);
    return res.json({ ok: false, error: 'portal_failed', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`RedzeUX Stripe license server on ${PUBLIC_BASE_URL} (port ${PORT})`);
  console.log(`Webhook: POST ${PUBLIC_BASE_URL}/webhook`);
  console.log(`Verify:  POST ${PUBLIC_BASE_URL}/v1/license/verify`);
  console.log(`Portal:  POST ${PUBLIC_BASE_URL}/v1/billing/portal`);
  console.log(`Success: GET  ${PUBLIC_BASE_URL}/success`);
  if (!process.env.RESEND_API_KEY) {
    console.log('Email:   RESEND_API_KEY not set — keys logged to console only');
  }
});
