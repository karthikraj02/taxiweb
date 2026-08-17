import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDriverMe, driverLogout as apiDriverLogout, unwrap, apiError } from '../api/index.js';
import toast from 'react-hot-toast';

const DriverContext = createContext(null);

export function DriverProvider({ children }) {
  const [driver, setDriver] = useState(null);
  const [canAcceptRides, setCanAcceptRides] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshDriver = useCallback(async () => {
    try {
      const data = unwrap(await getDriverMe());
      setDriver(data.driver);
      // Approval is separate from being signed in: a driver can log in while
      // still awaiting document review, and the dashboard must reflect that.
      setCanAcceptRides(Boolean(data.canAcceptRides));
      return data.driver;
    } catch {
      setDriver(null);
      setCanAcceptRides(false);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshDriver().finally(() => setLoading(false));
  }, [refreshDriver]);

  const loginDriver = (driverData, canAccept = false) => {
    setDriver(driverData);
    setCanAcceptRides(Boolean(canAccept));
  };

  const logoutDriver = async () => {
    try {
      await apiDriverLogout();
    } catch (err) {
      console.debug('Driver logout request failed:', apiError(err));
    }
    setDriver(null);
    setCanAcceptRides(false);
    toast.success('Signed out.');
  };

  return (
    <DriverContext.Provider value={{
      driver, loading, canAcceptRides,
      isDriverAuthenticated: !!driver,
      loginDriver, logoutDriver, refreshDriver,
    }}>
      {children}
    </DriverContext.Provider>
  );
}

export const useDriver = () => {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error('useDriver must be used within DriverProvider');
  return ctx;
};
