## DNV Server

Express server for Da Nang Villas payments and pricing.

### Setup

1. Create a `.env` file with:
```
STRIPE_PRIVATE_KEY=sk_test_...
CLIENT_URL=http://localhost:3000
```

2. Install dependencies:
```
npm install
```

3. Run locally:
```
npm run dev
```
Visit `http://localhost:3000`.

### API
- POST `/create-checkout-session`: accepts `{ items: [{ name, amountInCents, quantity }] }` and returns `{ url }` for Stripe Checkout.
- POST `/reserve`: accepts booking details; creates Stripe session based on calculated line items.
- POST `/calculate-price`: returns calculated totals for a stay.
- GET/POST `/health`: simple health check.

### Deploy on Vercel
This app is configured with `vercel.json` to run as a Node serverless function.