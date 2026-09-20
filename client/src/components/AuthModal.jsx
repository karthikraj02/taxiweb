import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { requestOTP, apiError } from '../api/index.js';
import toast from 'react-hot-toast';
import { Logo } from './Icons.jsx';

export default function AuthModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '', password: '' });

  const { login, register, loginWithOTP } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      onClose();
    } catch (err) {
      setError(apiError(err) || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (registerForm.password.length < 10) {
      setError('Password must be at least 10 characters.'); return;
    }
    if (!/[a-z]/.test(registerForm.password) || !/[A-Z]/.test(registerForm.password) || !/[0-9]/.test(registerForm.password)) {
      setError('Password must include an uppercase letter, a lowercase letter and a number.'); return;
    }
    if (!registerForm.email.trim() && !registerForm.phone.trim()) {
      setError('Enter an email address or a phone number.'); return;
    }
    setLoading(true);
    try {
      await register({
        name: registerForm.name.trim(),
        ...(registerForm.email.trim() ? { email: registerForm.email.trim() } : {}),
        ...(registerForm.phone.trim() ? { phone: registerForm.phone.trim() } : {}),
        password: registerForm.password,
      });
      onClose();
    } catch (err) {
      setError(apiError(err) || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!otpPhone) { setError('Please enter phone number'); return; }
    setError('');
    setLoading(true);
    try {
      await requestOTP(otpPhone);
      setOtpSent(true);
      toast.success('If that number is registered, a code has been sent.');
    } catch (err) {
      setError(apiError(err, 'Could not send the code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode) { setError('Please enter OTP'); return; }
    setError('');
    setLoading(true);
    try {
      await loginWithOTP(otpPhone, otpCode);
      onClose();
    } catch (err) {
      setError(apiError(err, 'That code was not accepted.'));
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    setOtpSent(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Close Button */}
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Header */}
        <div className="modal-head">
          <div className="logo-wrap"><Logo size={44} /></div>
          <h2>Welcome to Udupi Taxi</h2>
          <p>Sign in to book your ride</p>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { id: 'login', label: 'Log in' },
            { id: 'register', label: 'Register' },
            { id: 'otp', label: 'OTP' },
          ].map(t => (
            <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => handleTabChange(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="alert-error" role="alert">{error}
          </div>
        )}

        {/* Login Tab */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email Address</label>
              <input
                className="input" type="email" placeholder="your@email.com"
                value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                required autoFocus
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                className="input" type="password" placeholder="••••••••"
                value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', fontWeight: 600, marginTop: '0.5rem' }}>
              {loading ? <span className="spinner" /> : 'Log in'}
            </button>
          </form>
        )}

        {/* Register Tab */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label>Full Name</label>
              <input
                className="input" placeholder="e.g. Ramesh Kumar"
                value={registerForm.name} onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))}
                required autoFocus
              />
            </div>
            <div className="input-group">
              <label>Email Address</label>
              <input
                className="input" type="email" placeholder="your@email.com"
                value={registerForm.email} onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="input-group">
              <label>Phone Number</label>
              <input
                className="input" type="tel" placeholder="+91 XXXXX XXXXX"
                value={registerForm.phone} onChange={e => setRegisterForm(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="input-group">
              <label>Password (min 6 chars)</label>
              <input
                className="input" type="password" placeholder="••••••••"
                value={registerForm.password} onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', fontWeight: 600, marginTop: '0.5rem' }}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
        )}

        {/* OTP Tab */}
        {activeTab === 'otp' && (
          <div>
            <div className="input-group">
              <label>Phone Number</label>
              <input
                className="input" type="tel" placeholder="+91 XXXXX XXXXX"
                value={otpPhone} onChange={e => setOtpPhone(e.target.value)}
                disabled={otpSent} autoFocus
              />
            </div>
            {!otpSent ? (
              <button className="btn btn-primary" onClick={handleSendOTP} disabled={loading} style={{ width: '100%', justifyContent: 'center', fontWeight: 600 }}>
                {loading ? <span className="spinner" /> : 'Send OTP'}
              </button>
            ) : (
              <>
                <div className="input-group" style={{ marginTop: '0.5rem' }}>
                  <label>Enter OTP (6 digits)</label>
                  <input
                    className="input" type="text" inputMode="numeric" maxLength={6}
                    placeholder="123456" value={otpCode} onChange={e => setOtpCode(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => setOtpSent(false)} style={{ flex: 1, justifyContent: 'center' }}>
                    Change number
                  </button>
                  <button className="btn btn-primary" onClick={handleVerifyOTP} disabled={loading} style={{ flex: 2, justifyContent: 'center', fontWeight: 600 }}>
                    {loading ? <span className="spinner" /> : 'Verify OTP'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
