import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

// Fetch CSRF token once and attach to all mutating requests
let csrfToken = null;
const getCsrfToken = async () => {
  if (!csrfToken) {
    try {
      const { data } = await api.get('/api/csrf-token');
      csrfToken = data.csrfToken;
    } catch (err) {
      console.debug('CSRF token fetch failed (will proceed without it):', err.message);
    }
  }
  return csrfToken;
};

api.interceptors.request.use(async (config) => {
  const safeMethods = ['get', 'head', 'options'];
  if (!safeMethods.includes((config.method || '').toLowerCase())) {
    const token = await getCsrfToken();
    if (token) config.headers['x-csrf-token'] = token;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (token) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(resolve => {
          refreshSubscribers.push(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        onRefreshed(data.accessToken);
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const login = (email, password) => api.post('/api/auth/login', { email, password });
export const register = (name, email, phone, password) => api.post('/api/auth/register', { name, email, phone, password });
export const requestOTP = (phone) => api.post('/api/auth/request-otp', { phone });
export const verifyOTP = (phone, otp) => api.post('/api/auth/verify-otp', { phone, otp });
export const logout = () => api.post('/api/auth/logout');
export const refreshToken = () => api.post('/api/auth/refresh');
export const getMe = () => api.get('/api/auth/me');

export const createBooking = (data) => api.post('/api/bookings', data);
export const getBookings = () => api.get('/api/bookings');
export const getBooking = (id) => api.get(`/api/bookings/${id}`);
export const cancelBooking = (id) => api.delete(`/api/bookings/${id}`);

export const estimateFare = (carType, distance, tripType) =>
  api.post('/api/pricing/estimate', { carType, distance, tripType });
export const getTariffs = () => api.get('/api/pricing/tariffs');

export const createPaymentOrder = (bookingId, amount) =>
  api.post('/api/payments/razorpay/order', { bookingId, amount });
export const verifyPayment = (data) => api.post('/api/payments/razorpay/verify', data);

export const getDrivers = (carType) =>
  api.get('/api/drivers', { params: carType ? { carType } : {} });

export const getAllDrivers = () => api.get('/api/drivers/all');

export const updateBookingStatus = (id, status) =>
  api.put(`/api/bookings/${id}/status`, { status });

export const driverRequestOTP = (email) => api.post('/api/driver-auth/request-otp', { email });
export const driverVerifyOTP = (email, otp) => api.post('/api/driver-auth/verify-otp', { email, otp });
export const driverRegister = (formData) =>
  api.post('/api/driver-auth/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const driverLogout = () => api.post('/api/driver-auth/logout');
export const getDriverMe = () => api.get('/api/driver-auth/me');

export default api;
