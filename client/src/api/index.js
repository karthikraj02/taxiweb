import axios from 'axios';

/**
 * API client.
 *
 * Changes from the previous version, all of which were live bugs:
 *
 *  - The 401 refresh handler called `axios.post('/api/auth/refresh')` on a bare
 *    axios instance with a RELATIVE url, so on a deployed frontend it hit the
 *    Vercel origin instead of the API and silently never refreshed anything.
 *  - It also resolved queued requests with an Authorization header even though
 *    the app authenticates by HttpOnly cookie.
 *  - The CSRF token was fetched once and cached forever, so it went stale after
 *    a session change and every mutation started failing.
 */

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
});

/** Unwraps the { success, data } envelope the API now returns. */
export function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

/** Normalises an axios error into a displayable message. */
export function apiError(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Check your connection and try again.';
  if (!err?.response) return 'We could not reach the server. Check your connection and try again.';
  return fallback;
}

/** Machine-readable error code, for callers that branch on it. */
export function apiErrorCode(err) {
  return err?.response?.data?.error?.code || null;
}

// ---------------------------------------------------------------- CSRF

let csrfToken = null;
let csrfPromise = null;

async function ensureCsrfToken(force = false) {
  if (csrfToken && !force) return csrfToken;
  if (!csrfPromise || force) {
    csrfPromise = api.get('/api/csrf-token')
      .then(res => {
        csrfToken = unwrap(res).csrfToken;
        return csrfToken;
      })
      .catch(() => null)
      .finally(() => { csrfPromise = null; });
  }
  return csrfPromise;
}

const SAFE_METHODS = ['get', 'head', 'options'];

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!SAFE_METHODS.includes(method)) {
    const token = await ensureCsrfToken();
    if (token) config.headers['x-csrf-token'] = token;
  }
  return config;
});

// ------------------------------------------------------- refresh handling

let refreshPromise = null;

api.interceptors.response.use(
  response => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    // A stale CSRF token is recoverable: fetch a new one and retry once.
    if (status === 403 && code === 'CSRF_FAILED' && original && !original._csrfRetry) {
      original._csrfRetry = true;
      await ensureCsrfToken(true);
      return api(original);
    }

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }
    // Never try to refresh the refresh call itself, or the auth probes.
    if (/\/api\/(auth|driver-auth)\/(refresh|login|logout|me)/.test(original.url || '')) {
      return Promise.reject(error);
    }

    original._retry = true;

    // Drivers and customers have separate refresh endpoints; pick by url.
    const isDriverCall = /\/api\/(driver|driver-auth)\//.test(original.url || '');
    const refreshUrl = isDriverCall ? '/api/driver-auth/refresh' : '/api/auth/refresh';

    if (!refreshPromise) {
      refreshPromise = api.post(refreshUrl).finally(() => { refreshPromise = null; });
    }

    try {
      await refreshPromise;
      return api(original);          // cookies were reset by the refresh
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

// ------------------------------------------------------------- endpoints

// Auth
export const login = (email, password) => api.post('/api/auth/login', { email, password });
export const register = (payload) => api.post('/api/auth/register', payload);
export const requestOTP = (phone) => api.post('/api/auth/request-otp', { phone });
export const verifyOTP = (phone, otp) => api.post('/api/auth/verify-otp', { phone, otp });
export const logout = () => api.post('/api/auth/logout');
export const logoutAll = () => api.post('/api/auth/logout-all');
export const getMe = () => api.get('/api/auth/me');
export const changePassword = (currentPassword, newPassword) =>
  api.post('/api/auth/change-password', { currentPassword, newPassword });
export const forgotPassword = (email) => api.post('/api/auth/forgot-password', { email });
export const resetPassword = (email, otp, newPassword) =>
  api.post('/api/auth/reset-password', { email, otp, newPassword });

// Pricing — quotes take coordinates, never a client-supplied distance.
export const getTariffs = () => api.get('/api/pricing/tariffs');
export const quoteTrip = (trip) => api.post('/api/pricing/quote', trip);

// Bookings
export const createBooking = (trip, idempotencyKey) =>
  api.post('/api/bookings', trip, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  });
export const getBookings = (params) => api.get('/api/bookings', { params });
export const getBooking = (id) => api.get(`/api/bookings/${id}`);
export const cancelBooking = (id, reason) =>
  api.delete(`/api/bookings/${id}`, { data: reason ? { reason } : {} });
export const dispatchBooking = (id) => api.post(`/api/bookings/${id}/dispatch`);

// Payments
export const createPaymentOrder = (bookingId) =>
  api.post('/api/payments/razorpay/order', { bookingId });
export const verifyPayment = (payload) => api.post('/api/payments/razorpay/verify', payload);
export const getPayments = () => api.get('/api/payments');
export const requestRefund = (paymentId, reason) =>
  api.post(`/api/payments/${paymentId}/refund-request`, { reason });

// Drivers (public)
export const getDrivers = (carType) =>
  api.get('/api/drivers', { params: carType ? { carType } : {} });

// Driver auth
export const driverRegister = (payload) => api.post('/api/driver-auth/register', payload);
export const driverUploadDocuments = (formData) =>
  api.post('/api/driver-auth/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const driverRequestOTP = (email) => api.post('/api/driver-auth/request-otp', { email });
export const driverVerifyOTP = (email, otp) => api.post('/api/driver-auth/verify-otp', { email, otp });
export const driverLogout = () => api.post('/api/driver-auth/logout');
export const getDriverMe = () => api.get('/api/driver-auth/me');

// Driver dashboard
export const getDriverStatus = () => api.get('/api/driver/status');
export const getDriverRequests = () => api.get('/api/driver/requests');
export const acceptBookingRequest = (id) => api.post(`/api/driver/requests/${id}/accept`);
export const declineBookingRequest = (id) => api.post(`/api/driver/requests/${id}/decline`);
export const advanceRide = (id, action) => api.post(`/api/driver/rides/${id}/advance`, { action });
export const getDriverStats = () => api.get('/api/driver/stats');
export const getDriverRides = (params) => api.get('/api/driver/rides', { params });
export const updateDriverLocation = (payload) => api.put('/api/drivers/me/location', payload);
export const setDriverAvailability = (availability) =>
  api.put('/api/drivers/me/availability', { availability });

// Contact & reviews
export const sendContactMessage = (payload) => api.post('/api/contact', payload);
export const getReviews = () => api.get('/api/reviews');
export const submitReview = (bookingId, rating, comment) =>
  api.post(`/api/reviews/booking/${bookingId}`, { rating, comment });

// Admin
export const getAdminStats = () => api.get('/api/admin/stats');
export const getAdminBookings = (params) => api.get('/api/admin/bookings', { params });
export const updateBookingStatus = (id, status, reason) =>
  api.put(`/api/admin/bookings/${id}/status`, { status, reason });
export const getAdminDrivers = (params) => api.get('/api/admin/drivers', { params });
export const setDriverApproval = (id, decision, reason) =>
  api.put(`/api/admin/drivers/${id}/approval`, { decision, reason });
export const getAdminPayments = (params) => api.get('/api/admin/payments', { params });
export const refundPayment = (id, reason, amountPaise) =>
  api.post(`/api/admin/payments/${id}/refund`, { reason, ...(amountPaise ? { amountPaise } : {}) });
export const getContactMessages = (params) => api.get('/api/admin/contact-messages', { params });
export const getAuditLogs = (params) => api.get('/api/admin/audit-logs', { params });

export default api;
