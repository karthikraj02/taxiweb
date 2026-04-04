import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDriverMe, driverLogout as apiDriverLogout } from '../api/index.js';
import toast from 'react-hot-toast';

const DriverContext = createContext(null);

export function DriverProvider({ children }) {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDriverAuth = async () => {
      try {
        const { data } = await getDriverMe();
        setDriver(data.driver || null);
      } catch (err) {
        if (err?.response?.status !== 401) {
          console.debug('Driver auth check failed:', err.message);
        }
        setDriver(null);
      } finally {
        setLoading(false);
      }
    };
    checkDriverAuth();
  }, []);

  const loginDriver = (driverData) => {
    setDriver(driverData);
  };

  const logoutDriver = async () => {
    try {
      await apiDriverLogout();
    } catch (err) {
      console.debug('Driver logout API call failed (clearing local state anyway):', err.message);
    }
    setDriver(null);
    toast.success('Logged out successfully');
  };

  return (
    <DriverContext.Provider value={{ driver, loading, isDriverAuthenticated: !!driver, loginDriver, logoutDriver }}>
      {children}
    </DriverContext.Provider>
  );
}

export const useDriver = () => {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error('useDriver must be used within DriverProvider');
  return ctx;
};
