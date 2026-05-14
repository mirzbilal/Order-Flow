-- ============================================================
-- OrderFlow — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Orders ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_order_id  TEXT UNIQUE,
  shopify_order_number TEXT,

  -- Customer
  customer_name     TEXT NOT NULL,
  customer_email    TEXT,
  customer_phone    TEXT,

  -- Shipping address
  shipping_address  TEXT,
  shipping_city     TEXT,
  shipping_province TEXT,
  shipping_country  TEXT DEFAULT 'Pakistan',
  shipping_zip      TEXT,

  -- Financials
  total_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency          TEXT DEFAULT 'PKR',
  payment_method    TEXT DEFAULT 'COD',

  -- Line items (stored as JSON for simplicity)
  line_items        JSONB DEFAULT '[]',

  -- Internal status
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','booked','in_transit','delivered','cancelled','returned')),

  -- Channel
  channel           TEXT DEFAULT 'shopify',

  -- PostEx fields
  postex_cn         TEXT,            -- consignment number
  postex_tracking   TEXT,            -- tracking number
  postex_status     TEXT,            -- raw status from PostEx
  postex_booked_at  TIMESTAMPTZ,

  -- Shopify fulfillment
  shopify_fulfilled BOOLEAN DEFAULT FALSE,

  -- Notes
  notes             TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Shipments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  postex_cn       TEXT UNIQUE NOT NULL,
  tracking_number TEXT,
  status          TEXT DEFAULT 'booked',
  carrier         TEXT DEFAULT 'PostEx',

  -- Raw PostEx responses
  booking_response  JSONB,
  tracking_history  JSONB DEFAULT '[]',

  -- Label
  label_url       TEXT,

  booked_at       TIMESTAMPTZ DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Shopify sync log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopify_sync_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type    TEXT,  -- 'order_created', 'order_updated', 'manual_sync'
  shopify_order_id TEXT,
  status        TEXT,  -- 'success', 'error'
  details       JSONB,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PostEx webhook log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS postex_webhook_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cn          TEXT,
  event_data  JSONB,
  processed   BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_shopify_id   ON orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_postex_cn    ON orders(postex_cn);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id  ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_cn        ON shipments(postex_cn);

-- ─── Auto-update updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security (optional, recommended) ─────────────
-- If you add user auth, enable RLS:
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ─── WhatsApp Message Logs ───────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  phone       TEXT NOT NULL,
  event       TEXT NOT NULL CHECK (event IN ('confirmed','booked','shipped','delivered')),
  message     TEXT,
  twilio_sid  TEXT,
  status      TEXT DEFAULT 'sent',   -- sent | failed | delivered
  error       TEXT,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_order   ON whatsapp_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_event   ON whatsapp_logs(event);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sent_at ON whatsapp_logs(sent_at DESC);

-- ─── Settings rows for Shopify connection ────────────────────
INSERT INTO settings (key, value) VALUES
  ('shopify_connection', NULL),
  ('postex_connection', NULL),
  ('shopify_pending_oauth', NULL),
  ('shopify_oauth_state', NULL)
ON CONFLICT (key) DO NOTHING;

-- ─── WhatsApp Message Templates ─────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_type TEXT NOT NULL CHECK (webhook_type IN ('orders/creation','orders/fulfillment','orders/cancellation','abandoned_checkout')),
  message      TEXT NOT NULL,
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_type
  ON whatsapp_messages(webhook_type) WHERE active = TRUE;

CREATE TRIGGER whatsapp_messages_updated_at
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
