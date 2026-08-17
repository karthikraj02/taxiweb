import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin, register as apiRegister, verifyOTP as apiVerifyOTP,
  logout as apiLogout, getMe, unwrap, apiError,
} from '../api/index.js';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = unwrap(await getMe());
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email, password) => {
    const data = unwrap(await apiLogin(email, password));
    setUser(data.user);
    toast.success('Welcome back!');
    return data;
  };

  const loginWithOTP = async (phone, otp) => {
    const data = unwrap(await apiVerifyOTP(phone, otp));
    setUser(data.user);
    toast.success('Signed in.');
    return data;
  };

  const register = async (payload) => {
    const data = unwrap(await apiRegister(payload));
    setUser(data.user);
    toast.success('Account created.');
    return data;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      // The cookie may already be gone; clearing local state is still correct.
      console.debug('Logout request failed:', apiError(err));
    }
    setUser(null);
    toast.success('Signed out.');
  };

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      login, loginWithOTP, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
