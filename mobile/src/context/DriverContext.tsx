import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as endpoints from '../api/endpoints';
import { resetCsrf } from '../api/client';
import type { DriverProfile } from '../types';

interface DriverValue {
  driver: DriverProfile | null;
  loading: boolean;
  isDriverAuthenticated: boolean;
  /** Approved by an admin AND email verified. Registration alone does not allow rides. */
  canAcceptRides: boolean;
  loginDriver: (email: string, otp: string) => Promise<void>;
  refreshDriver: () => Promise<void>;
  logoutDriver: () => Promise<void>;
}

const DriverContext = createContext<DriverValue | null>(null);

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [canAcceptRides, setCanAcceptRides] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const me = await endpoints.getDriverMe();
    setDriver(me.driver);
    try {
      const status = await endpoints.getDriverStatus();
      setCanAcceptRides(Boolean(status.canAcceptRides));
    } catch {
      setCanAcceptRides(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch(() => { if (!cancelled) { setDriver(null); setCanAcceptRides(false); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const loginDriver = useCallback(async (email: string, otp: string) => {
    await endpoints.driverVerifyOtp(email.trim(), otp.trim());
    resetCsrf();
    await load();
  }, [load]);

  const refreshDriver = useCallback(async () => {
    try { await load(); } catch { /* keep the last known state */ }
  }, [load]);

  const logoutDriver = useCallback(async () => {
    try { await endpoints.driverLogout(); } catch { /* cookie expires on its own */ }
    resetCsrf();
    setDriver(null);
    setCanAcceptRides(false);
  }, []);

  const value = useMemo<DriverValue>(
    () => ({ driver, loading, isDriverAuthenticated: !!driver, canAcceptRides, loginDriver, refreshDriver, logoutDriver }),
    [driver, loading, canAcceptRides, loginDriver, refreshDriver, logoutDriver]
  );
  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
}

export function useDriver(): DriverValue {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error('useDriver must be used within DriverProvider');
  return ctx;
}
