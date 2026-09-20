import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as endpoints from '../api/endpoints';
import { resetCsrf } from '../api/client';
import type { User } from '../types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (p: { name: string; email?: string; phone?: string; password: string }) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a session from the stored cookies. The API client transparently
  // rotates the refresh cookie if the short-lived access cookie has expired.
  useEffect(() => {
    let cancelled = false;
    endpoints
      .getMe()
      .then((data) => { if (!cancelled) setUser(data.user); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await endpoints.login(email.trim(), password);
    resetCsrf(); // the CSRF token is bound to the session; fetch a new one
    setUser(data.user);
  }, []);

  const register = useCallback(async (p: { name: string; email?: string; phone?: string; password: string }) => {
    const data = await endpoints.register(p);
    resetCsrf();
    setUser(data.user);
  }, []);

  const loginWithOtp = useCallback(async (phone: string, otp: string) => {
    const data = await endpoints.verifyOtp(phone.trim(), otp.trim());
    resetCsrf();
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await endpoints.logout();
    } catch {
      // Clear local state regardless; the cookie expires on its own.
    }
    resetCsrf();
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, isAuthenticated: !!user, login, register, loginWithOtp, logout }),
    [user, loading, login, register, loginWithOtp, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
