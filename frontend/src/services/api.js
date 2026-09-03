import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Restaurant isolation header
  const slug = localStorage.getItem("restaurant_slug");
  if (slug) config.headers["x-restaurant-slug"] = slug;

  // Branch isolation header — sends current branch context from localStorage
  // NOTE: admin pages override this per-request using branchSlug from SlugContext
  const branchId = localStorage.getItem("branch_id");
  const branchSlug = localStorage.getItem("branch_slug");
  if (branchId) config.headers["x-branch-id"] = branchId;
  if (branchSlug) config.headers["x-branch-slug"] = branchSlug;

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const hadToken = !!localStorage.getItem("token");
    if (err.response?.status === 401 && hadToken) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("restaurant_slug");
      localStorage.removeItem("branch_id");
      localStorage.removeItem("branch_slug");
      const parts = window.location.pathname.split("/").filter(Boolean);
      const slug = parts.length > 0 ? `/${parts[0]}` : "";
      window.location.href = slug ? `${slug}/login` : "/login";
    }
    return Promise.reject(err);
  },
);

export default api;

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = import.meta.env.VITE_BACKEND_URL || "";
  return `${base}${path}`;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  registerStaff: (data) => api.post("/auth/register-staff", data),
  login: (data) => api.post("/auth/login", data),
  loginStaff: (data) => api.post("/auth/login-staff", data),
  getMe: () => api.get("/auth/me"),
  updateProfile: (data) => api.patch("/auth/me/profile", data),
  getUsers: () => api.get("/auth/users"),
  updateRole: (id, role) => api.patch(`/auth/users/${id}/role`, { role }),
  toggleActive: (id) => api.patch(`/auth/users/${id}/active`),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

// ─── Approvals ────────────────────────────────────────────────────────────────
export const approvalsAPI = {
  getPendingApprovals: () => api.get("/approvals/pending"),
  getApprovedStaff: () => api.get("/approvals/approved"),
  approveStaff: (userId) => api.post(`/approvals/${userId}/approve`),
  rejectStaff: (userId, reason) =>
    api.post(`/approvals/${userId}/reject`, { reason }),
  getApprovalStatus: () => api.get("/approvals/status/me"),
};

// ─── Menu ─────────────────────────────────────────────────────────────────────
// All admin menu methods accept an optional branchSlug as their last argument.
// When provided it is sent as the x-branch-slug header, overriding whatever
// localStorage has stored — so an admin visiting /gonder-hotel/branches/bole
// always reads/writes Bole's menu, not the main restaurant's.
export const menuAPI = {
  // ── Admin reads ────────────────────────────────────────────────────────────
  getItems: (params) => api.get("/menu/admin/items", { params }),

  getItem: (id) => api.get(`/menu/admin/items/${id}`),

  getCategories: (branchSlug = null) =>
    api.get("/menu/admin/categories", {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  getPromotions: (branchSlug = null) =>
    api.get("/menu/admin/promotions", {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  getRecommendations: (branchSlug = null) =>
    api.get("/menu/admin/recommendations", {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  // ── Admin writes ───────────────────────────────────────────────────────────
  createItem: (data, branchSlug = null) =>
    api.post("/menu/admin/items", data, {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  updateItem: (id, data, branchSlug = null) =>
    api.put(`/menu/admin/items/${id}`, data, {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  deleteItem: (id, branchSlug = null) =>
    api.delete(`/menu/admin/items/${id}`, {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  createCategory: (data, branchSlug = null) =>
    api.post("/menu/admin/categories", data, {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  updateCategory: (id, data, branchSlug = null) =>
    api.put(`/menu/admin/categories/${id}`, data, {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  deleteCategory: (id, deleteItems = false, branchSlug = null) =>
    api.delete(`/menu/admin/categories/${id}?deleteItems=${deleteItems}`, {
      ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
    }),

  reorderCategories: (order, branchSlug = null) =>
    api.post(
      "/menu/admin/categories/reorder",
      { order },
      {
        ...(branchSlug && { headers: { "x-branch-slug": branchSlug } }),
      },
    ),

  // ── Public slug-based routes ───────────────────────────────────────────────
  getPublicItems: (slug, params) => api.get(`/menu/${slug}/items`, { params }),

  getPublicCategories: (slug, branchSlug) =>
    api.get(`/menu/${slug}/categories`, {
      params: branchSlug ? { branch: branchSlug } : {},
    }),

  getPublicRecommendations: (slug, branchSlug) =>
    api.get(`/menu/${slug}/recommendations`, {
      params: branchSlug ? { branch: branchSlug } : {},
    }),

  getPublicPromotions: (slug, branchSlug) =>
    api.get(`/menu/${slug}/promotions`, {
      params: branchSlug ? { branch: branchSlug } : {},
    }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orderAPI = {
  place: (data, restaurantSlug, branchSlug) =>
    api.post("/orders", data, {
      headers: {
        ...(restaurantSlug && { "x-restaurant-slug": restaurantSlug }),
        ...(branchSlug && { "x-branch-slug": branchSlug }),
      },
    }),

  // Pass branch as a query param so the backend can filter rows by branch_id.
  getAll: (params) => api.get("/orders", { params }),

  getOne: (id) => api.get(`/orders/${id}`),

  getByGuestToken: (token, slug) =>
    api.get(`/orders/guest/${token}`, {
      params: { slug },
      headers: {
        ...(slug && { "x-restaurant-slug": slug }),
      },
    }),

  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),

  // branchSlug scopes analytics to a specific branch when provided.
  getAnalytics: (branchSlug = null) =>
    api.get("/orders/analytics", {
      params: { branch: branchSlug },
    }),

  // branchSlug scopes the items summary to a specific branch when provided.
  getOrderedItems: (period, sort, branchSlug = null) =>
    api.get("/orders/ordered-items", {
      params: { period, sort, branch: branchSlug },
    }),

  getFeedback: (id, restaurantSlug, branchId) =>
    api.get(`/orders/${id}/feedback`, {
      headers: {
        ...(restaurantSlug && { "x-restaurant-slug": restaurantSlug }),
        ...(branchId && { "x-branch-id": String(branchId) }),
      },
    }),

  submitFeedback: (id, data, restaurantSlug, branchId) =>
    api.post(`/orders/${id}/feedback`, data, {
      headers: {
        ...(restaurantSlug && { "x-restaurant-slug": restaurantSlug }),
        ...(branchId && { "x-branch-id": String(branchId) }),
      },
    }),

  acceptCashOrder: (id) => api.patch(`/orders/${id}/cash/accept`),

  markCashPaid: (id) => api.patch(`/orders/${id}/cash/paid`),

  completeCashOrder: (id) => api.patch(`/orders/${id}/cash/complete`),

  getCashierSummary: (params) => api.get("/orders/cashier/summary", { params }),
};

// ─── Feedback ─────────────────────────────────────────────────────────────────
// branchSlug is forwarded as a query param so the backend returns only
// feedback belonging to the branch the admin is currently viewing.
export const feedbackAPI = {
  getAll: (branchSlug = null) =>
    api.get("/feedback", {
      params: branchSlug ? { branch: branchSlug } : {},
    }),
};

// ─── Restaurants ──────────────────────────────────────────────────────────────
export const restaurantsAPI = {
  getPublic: (slug) => api.get(`/restaurants/${slug}`),

  // branchSlug is accepted for future branch-level branding support.
  // Currently ignored by the backend but safe to send.
  getMy: (branchSlug = null) =>
    api.get("/restaurants/me", {
      ...(branchSlug && { params: { branch: branchSlug } }),
    }),

  uploadLogo: (formData) =>
    api.post("/restaurants/me/logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ─── Branches ─────────────────────────────────────────────────────────────────
export const branchesAPI = {
  list: () => api.get("/branches"),
  listPublic: (restaurantSlug) => api.get(`/branches/public/${restaurantSlug}`),
  get: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post("/branches", data),
  update: (id, data) => api.patch(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`),
  getUsers: (id) => api.get(`/branches/${id}/users`),
  assignUser: (userId, branchId) =>
    api.patch(`/branches/users/${userId}/assign`, { branch_id: branchId }),
  getLimits: () => api.get("/branches/subscription/limits"),
};
