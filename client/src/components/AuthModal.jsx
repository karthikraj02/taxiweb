import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { requestOTP } from '../api/index.js';
import toast from 'react-hot-toast';

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
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (registerForm.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(registerForm.name, registerForm.email, registerForm.phone, registerForm.password);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!otpPhone) { setError('Please enter phone number'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await requestOTP(otpPhone);
      setOtpSent(true);
      toast.success('OTP sent successfully!');
      if (data.otp) toast(`Dev OTP: ${data.otp}`, { icon: '🔑', duration: 10000 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
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
      setError(err.response?.data?.message || 'OTP verification failed');
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
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text-light)',
            width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
            fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚕</div>
          <h2 style={{ fontWeight: 700, fontSize: '1.4rem' }}>Welcome to Udupi Taxi</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Sign in to book your ride</p>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { id: 'login', label: 'Login' },
            { id: 'register', label: 'Register' },
            { id: 'otp', label: 'OTP Login' },
          ].map(t => (
            <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => handleTabChange(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', padding: '0.75rem 1rem', borderRadius: '0.5rem',
            fontSize: '0.875rem', marginBottom: '1rem',
          }}>
            ⚠️ {error}
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
              {loading ? <span className="spinner" /> : 'Login'}
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
                {loading ? <span className="spinner" /> : '📱 Send OTP'}
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
                    ← Change Number
                  </button>
                  <button className="btn btn-primary" onClick={handleVerifyOTP} disabled={loading} style={{ flex: 2, justifyContent: 'center', fontWeight: 600 }}>
                    {loading ? <span className="spinner" /> : '✓ Verify OTP'}
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
