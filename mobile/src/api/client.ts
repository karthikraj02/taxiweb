import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_URL } from '../config';

/**
 * API client.
 *
 * The backend authenticates with HttpOnly cookies plus a double-submit CSRF
 * token, exactly as it does for the website. React Native's networking layer
 * keeps a native cookie jar (NSHTTPCookieStorage on iOS, the WebKit cookie
 * store on Android), so cookies set by login / refresh / csrf-token are stored
 * and replayed automatically. Native requests carry no `Origin` header, which
 * the server's CORS policy allows.
 *
 * So this file mirrors client/src/api/index.js:
 *   - fetch a CSRF token before any non-GET request, and refetch + retry once
 *     if the server says it is stale (it is bound to the session cookie, so it
 *     changes after login and logout)
 *   - on a 401, rotate the refresh cookie once and retry
 */

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 25000,
  headers: { Accept: 'application/json' },
});

/** Unwraps the { success, data } envelope the API returns. */
export function unwrap<T = any>(response: AxiosResponse): T {
  return (response?.data?.data ?? response?.data) as T;
}

/** Turns any thrown error into a message fit to show a person. */
export function apiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as AxiosError<any>;
  const message = e?.response?.data?.error?.message;
  if (message) return message;
  if (e?.code === 'ECONNABORTED') return 'The request timed out. Check your connection and try again.';
  if (!e?.response) return 'We could not reach the server. Check your connection and try again.';
  return fallback;
}

export function apiErrorCode(err: unknown): string | null {
  return (err as AxiosError<any>)?.response?.data?.error?.code ?? null;
}

export function apiStatus(err: unknown): number | null {
  return (err as AxiosError)?.response?.status ?? null;
}

// ---------------------------------------------------------------- CSRF

let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

async function ensureCsrfToken(force = false): Promise<string | null> {
  if (csrfToken && !force) return csrfToken;
  if (!csrfPromise || force) {
    csrfPromise = api
      .get('/api/csrf-token')
      .then((res) => {
        csrfToken = unwrap<{ csrfToken: string }>(res).csrfToken;
        return csrfToken;
      })
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

/** Call after the session changes (login / logout) so the next write refetches. */
export function resetCsrf() {
  csrfToken = null;
}

const SAFE_METHODS = ['get', 'head', 'options'];

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!SAFE_METHODS.includes(method)) {
    const token = await ensureCsrfToken();
    if (token) config.headers.set('x-csrf-token', token);
  }
  return config;
});

// ------------------------------------------------------ refresh handling

type RetryConfig = AxiosRequestConfig & { _retry?: boolean; _csrfRetry?: boolean };

const refreshPromises: Record<string, Promise<unknown> | null> = { user: null, driver: null };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    if (!original) return Promise.reject(error);

    // A stale CSRF token is recoverable: fetch a new one and retry once.
    if (status === 403 && code === 'CSRF_FAILED' && !original._csrfRetry) {
      original._csrfRetry = true;
      await ensureCsrfToken(true);
      return api(original);
    }

    if (status !== 401 || original._retry) return Promise.reject(error);

    const url = original.url || '';
    // Never try to refresh the refresh call itself, or the sign-in calls.
    if (/\/api\/(auth|driver-auth)\/(refresh|login|logout|verify-otp|request-otp|register)/.test(url)) {
      return Promise.reject(error);
    }

    original._retry = true;

    // Customers and drivers keep separate sessions and separate refresh cookies.
    const kind = /\/api\/(driver|driver-auth)\//.test(url) || /\/api\/drivers\/me/.test(url) ? 'driver' : 'user';
    const refreshUrl = kind === 'driver' ? '/api/driver-auth/refresh' : '/api/auth/refresh';

    if (!refreshPromises[kind]) {
      refreshPromises[kind] = api.post(refreshUrl).finally(() => {
        refreshPromises[kind] = null;
      });
    }

    try {
      await refreshPromises[kind];
      return api(original);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default api;
