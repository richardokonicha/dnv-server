require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Root route serves the static index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Stripe checkout
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

// keep logic simple and close to the routes

app.post('/create-checkout-session', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Missing or empty items array' });
    }

    const villaName = req.body.villaName || '';
    const host = req.headers.host || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const base = (process.env.CLIENT_URL || `${proto}://${host}`).replace(/\/$/, '');
    const successUrl = (process.env.SUCCESS_URL || `${base}/success.html`).replace(/\/$/, '');
    const cancelUrl = (process.env.CANCEL_URL || `${base}/cancel.html`).replace(/\/$/, '');

    const line_items = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: villaName ? `${villaName} – ${item.name}` : item.name },
        unit_amount: item.amountInCents,
      },
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_intent_data: {
        description: villaName ? `Booking: ${villaName}` : undefined,
        metadata: villaName ? { villaName } : undefined,
      },
      custom_text: villaName ? { submit: { message: `Booking: ${villaName}` } } : undefined,
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error('[SERVER] Error creating checkout session:', e);
    return res.status(500).json({ error: e.message });
  }
});

// Reserve based on computed line items from input
app.post('/reserve', async (req, res) => {
  try {
    const { villaName, baseRate, cleaningFee, checkIn, checkOut, villaSlug } = req.body;
    if (!villaName || !baseRate || !cleaningFee || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Missing required booking data' });
    }

    const { lineItems, nights } = calculateBookingPrice(baseRate, cleaningFee, checkIn, checkOut);

    const host = req.headers.host || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const base = (process.env.CLIENT_URL || `${proto}://${host}`).replace(/\/$/, '');
    const villasBase = (process.env.VILLAS_DETAILS_BASE_URL || '').replace(/\/$/, '');
    const successUrl = (process.env.SUCCESS_URL || (villasBase && villaSlug ? `${villasBase}/${villaSlug}` : `${base}/success.html`)).replace(/\/$/, '');
    const cancelUrl = (process.env.CANCEL_URL || (villasBase && villaSlug ? `${villasBase}/${villaSlug}` : `${base}/cancel.html`)).replace(/\/$/, '');

    const line_items = lineItems.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: `${villaName} – ${item.name}` },
        unit_amount: item.amountInCents,
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_intent_data: {
        description: `Booking: ${villaName}`,
        metadata: { villaName, villaSlug: villaSlug || '', checkIn, checkOut, nights },
      },
      custom_text: { submit: { message: `Booking: ${villaName}` } },
    });
    return res.json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/calculate-price', (req, res) => {
  try {
    const { villaName, villaSlug, baseRate, cleaningFee, icalFeed, checkIn, checkOut } = req.body;
    if (!villaName || !villaSlug || !baseRate || cleaningFee === undefined || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // DRY: reuse calculateBookingPrice for date math and validation
    const { nights } = calculateBookingPrice(baseRate, cleaningFee, checkIn, checkOut);
    if (nights <= 0) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    const baseRateNum = parseFloat(baseRate);
    const cleaningFeeNum = parseFloat(cleaningFee);
    const totalPrice = baseRateNum * nights + cleaningFeeNum;

    return res.json({
      villaName,
      villaSlug,
      icalFeed,
      nights,
      baseRate: baseRateNum,
      cleaningFee: cleaningFeeNum,
      totalPrice,
      checkIn,
      checkOut,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple health check
app.get('/health', (req, res) => {
  res.json({ message: 'Server is running' });
});
app.post('/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

function calculateBookingPrice(baseRate, cleaningFee, checkIn, checkOut) {
  const startDate = new Date(checkIn);
  const endDate = new Date(checkOut);
  const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  if (nights <= 0) {
    throw new Error('Invalid date range');
  }

  const baseRateCents = Math.round(parseFloat(baseRate) * 100);
  const cleaningFeeCents = Math.round(parseFloat(cleaningFee) * 100);
  const totalBase = baseRateCents * nights;

  return {
    nights,
    baseRateCents,
    cleaningFeeCents,
    totalBase,
    totalPrice: totalBase + cleaningFeeCents,
    lineItems: [
      {
        name: `${nights} nights × $${baseRate}`,
        amountInCents: totalBase,
        quantity: 1,
      },
      {
        name: 'Cleaning Fee',
        amountInCents: cleaningFeeCents,
        quantity: 1,
      },
    ],
  };
}

function getBaseUrl(req) {
  // Prefer explicit env, then Origin header, then sensible local default
  const envUrl = process.env.CLIENT_URL && process.env.CLIENT_URL.trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  const origin = req.headers.origin || '';
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  return `${protocol}://${host}`.replace(/\/$/, '');
}

// For Vercel: export the app without calling listen
module.exports = app;


