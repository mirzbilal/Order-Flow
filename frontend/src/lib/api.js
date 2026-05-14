// frontend/src/lib/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Orders ───────────────────────────────────────────────────
export const ordersApi = {
  list:           (params) => api.get('/api/orders', { params }).then(r => r.data),
  get:            (id)     => api.get(`/api/orders/${id}`).then(r => r.data),
  update:         (id, body) => api.patch(`/api/orders/${id}`, body).then(r => r.data),
  cancel:         (id)     => api.post(`/api/orders/${id}/cancel`).then(r => r.data),
  track:          (id)     => api.get(`/api/orders/${id}/track`).then(r => r.data),
  bookPostex:     (id)     => api.post(`/api/orders/${id}/book-postex`).then(r => r.data),
  fulfillShopify: (id)     => api.post(`/api/orders/${id}/fulfill-shopify`).then(r => r.data),
};

// ─── Shopify ──────────────────────────────────────────────────
export const shopifyApi = {
  sync:             ()        => api.post('/api/shopify/sync').then(r => r.data),
  syncStatus:       ()        => api.get('/api/shopify/sync-status').then(r => r.data),
  registerWebhooks: (appUrl)  => api.post('/api/shopify/register-webhooks', { appUrl }).then(r => r.data),
};

// ─── PostEx ───────────────────────────────────────────────────
export const postexApi = {
  cities:       ()   => api.get('/api/postex/cities').then(r => r.data),
  track:        (cn) => api.get(`/api/postex/track/${cn}`).then(r => r.data),
  syncTracking: ()   => api.post('/api/postex/sync-tracking').then(r => r.data),
};

// ─── Analytics ────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => api.get('/api/analytics/dashboard').then(r => r.data),
};

export default api;

// ─── WhatsApp API ─────────────────────────────────────────────
export const whatsappApi = {
  stats:   ()           => api.get('/whatsapp/stats').then(r => r.data),
  logs:    (params={})  => api.get('/whatsapp/logs', { params }).then(r => r.data),
  test:    (phone)      => api.post('/whatsapp/test', { phone }).then(r => r.data),
  send:    (orderId, event) => api.post(`/whatsapp/send/${orderId}`, { event }).then(r => r.data),
};
