import axios from 'axios';
import { getCsrfToken, clearCsrfToken, fetchCsrfToken } from '../utils/csrfToken';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach CSRF token to every state-changing request before it is sent.
api.interceptors.request.use(async (config) => {
  const method = (config.method || '').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();
    config.headers['x-csrf-token'] = token;
  }
  return config;
});

// If the server rejects the request with a 403 (stale/invalid token), obtain a
// fresh token and replay the original request exactly once.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 403 &&
      !originalRequest._csrfRetry
    ) {
      originalRequest._csrfRetry = true;
      try {
        clearCsrfToken();
        const freshToken = await fetchCsrfToken();
        originalRequest.headers['x-csrf-token'] = freshToken;
        return api(originalRequest);
      } catch (retryError) {
        return Promise.reject(retryError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
