# OrderFlow — Full Stack Order Management System

Shopify + PostEx + Supabase integration.

## Project Structure

```
orderflow/
├── backend/          # Node.js + Express API server
│   ├── routes/       # API route handlers
│   ├── middleware/   # Auth, error handling
│   ├── services/     # PostEx, Shopify, Supabase service layers
│   ├── webhooks/     # Webhook handlers
│   └── server.js     # Entry point
├── frontend/         # React app (Vite)
│   └── src/
│       ├── pages/    # Dashboard, Orders, Shipping, etc.
│       ├── components/
│       ├── services/ # API client
│       └── hooks/
└── supabase/
    └── schema.sql    # Full database schema
```

## Quick Start

### 1. Supabase Setup
Run `supabase/schema.sql` in your Supabase SQL editor.

### 2. Backend Setup
```bash
cd backend
cp .env.example .env   # Fill in your credentials
npm install
npm run dev            # Runs on http://localhost:4000
```

### 3. Frontend Setup
```bash
cd frontend
cp .env.example .env   # Set VITE_API_URL=http://localhost:4000
npm install
npm run dev            # Runs on http://localhost:5173
```

## Environment Variables

### Backend `.env`
```
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxx
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

POSTEX_API_URL=https://api.postex.pk/services/integration/api
POSTEX_TOKEN=your-postex-token
POSTEX_MERCHANT_CODE=your-merchant-code
POSTEX_PICKUP_ADDRESS_CODE=your-pickup-address-code

WEBHOOK_BASE_URL=https://your-backend-domain.com
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:4000
```

## PostEx API Info
- Base URL: `https://api.postex.pk/services/integration/api`
- Auth: `token` header
- Docs: Request from PostEx merchant support

## Shopify Setup
1. Go to Shopify Admin → Apps → Develop apps
2. Create private app with `read_orders`, `write_fulfillments` scopes
3. Copy the access token to `.env`
4. Register webhooks (app does this automatically on startup)
