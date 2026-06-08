import axios from 'axios';

const subApi = axios.create({
  baseURL: import.meta.env.VITE_SUBSCRIPTION_API_URL || 'http://localhost:5001/api',
  timeout: 30000,
});

// Attach the subscription-specific token on every request
subApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('sub_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear the sub token (don't redirect — the main app handles that)
subApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sub_token');
    }
    return Promise.reject(err);
  }
);

export default subApi;

// ── Auth ──────────────────────────────────────────────────────────────────
export const subAuthAPI = {
  login: (email, password) => subApi.post('/auth/login', { email, password }),
  register: (data) => subApi.post('/auth/register', data),
};

// ── Subscriptions ─────────────────────────────────────────────────────────
export const subscriptionAPI = {
  getPlans: () => subApi.get('/subscriptions/plans'),
  getMySubscriptions: () => subApi.get('/subscriptions/me'),
  getOne: (id) => subApi.get(`/subscriptions/${id}`),
  create: (plan_name, billing_cycle) =>
    subApi.post('/subscriptions', { plan_name, billing_cycle }),
  cancel: (id) => subApi.put(`/subscriptions/${id}/cancel`),
};

// ── Payments / Invoices ───────────────────────────────────────────────────
export const invoiceAPI = {
  getPaymentInfo: () => subApi.get('/payments/info'),
  submitPayment: (formData) =>
    subApi.post('/payments/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMyInvoices: () => subApi.get('/payments/invoices/me'),
  getInvoice: (id) => subApi.get(`/payments/invoices/${id}`),
};
