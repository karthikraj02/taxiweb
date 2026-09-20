import Constants from 'expo-constants';

/**
 * Backend base URL.
 *
 * Order of precedence:
 *   1. EXPO_PUBLIC_API_URL (set in mobile/.env or the shell) - use this for a
 *      local backend, e.g. http://192.168.1.20:5000 (use your computer's LAN IP,
 *      not "localhost", when testing on a physical phone).
 *   2. `extra.apiUrl` from app.json (the deployed backend).
 */
const fromEnv = process.env.EXPO_PUBLIC_API_URL;
const fromApp = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const API_URL = (fromEnv || fromApp || 'https://taxiweb-backend.vercel.app').replace(/\/+$/, '');

export const SUPPORT_PHONE_DISPLAY = '+91 97314 70096';
export const SUPPORT_PHONE_TEL = 'tel:+919731470096';
export const SUPPORT_EMAIL = 'bookings@udupikaxi.com';

/** How often (ms) to refresh a trip / the driver's request list while open. */
export const POLL_MS = 10000;
