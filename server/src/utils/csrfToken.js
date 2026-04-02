const CSRF_TOKEN_KEY = 'csrf_token';
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Fetch a fresh CSRF token from the backend and cache it in sessionStorage.
 * @returns {Promise<string>} The CSRF token string.
 */
export async function fetchCsrfToken() {
  const response = await fetch(`${API_BASE}/api/csrf-token`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token: ${response.status}`);
  }
  const data = await response.json();
  const token = data.csrfToken;
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  return token;
}

/**
 * Return the cached CSRF token, or fetch a new one if none is stored.
 * @returns {Promise<string>}
 */
export async function getCsrfToken() {
  const cached = sessionStorage.getItem(CSRF_TOKEN_KEY);
  if (cached) return cached;
  return fetchCsrfToken();
}

/**
 * Remove the cached CSRF token so the next call to getCsrfToken fetches a fresh one.
 */
export function clearCsrfToken() {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
}
