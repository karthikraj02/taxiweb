import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, verifyOTP as apiVerifyOTP, requestOTP as apiRequestOTP, logout as apiLogout, getMe } from '../api/index.js';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await getMe();
        setUser(data.user || data);
      } catch (err) {
        if (err?.response?.status !== 401) {
          console.debug('Auth check failed:', err.message);
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await apiLogin(email, password);
    setUser(data.user);
    toast.success('Welcome back!');
    return data;
  };

  const loginWithOTP = async (phone, otp) => {
    const { data } = await apiVerifyOTP(phone, otp);
    setUser(data.user);
    toast.success('Logged in successfully!');
    return data;
  };

  const register = async (name, email, phone, password) => {
    const { data } = await apiRegister(name, email, phone, password);
    setUser(data.user);
    toast.success('Account created successfully!');
    return data;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.debug('Logout API call failed (clearing local state anyway):', err.message);
    }
    setUser(null);
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, loginWithOTP, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
