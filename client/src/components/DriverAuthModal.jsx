import React, { useState } from 'react';
import { driverRegister, driverRequestOTP, driverVerifyOTP } from '../api/index.js';
import toast from 'react-hot-toast';

const CAR_TYPES = [
  { value: 'etios', label: 'Toyota Etios' },
  { value: 'dzire', label: 'Maruti Dzire' },
  { value: 'innova', label: 'Toyota Innova' },
  { value: 'tempo', label: 'Tempo Traveller' },
];

export default function DriverAuthModal({ onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Register state
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    carType: '',
    carNumber: '',
  });
  const [driverPhotoFile, setDriverPhotoFile] = useState(null);
  const [carPhotoFile, setCarPhotoFile] = useState(null);
  const [driverPhotoPreview, setDriverPhotoPreview] = useState(null);
  const [carPhotoPreview, setCarPhotoPreview] = useState(null);
  const [registered, setRegistered] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    setOtpSent(false);
    setRegistered(false);
  };

  // ─── Login (Email OTP) ─────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!loginEmail) { setError('Please enter your email address'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await driverRequestOTP(loginEmail);
      setOtpSent(true);
      toast.success('OTP sent to your email!');
      if (data.otp) toast(`Dev OTP: ${data.otp}`, { icon: '🔑', duration: 10000 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode) { setError('Please enter the OTP'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await driverVerifyOTP(loginEmail, otpCode);
      toast.success(`Welcome, ${data.driver?.name || 'Driver'}!`);
      if (onLoginSuccess) onLoginSuccess(data.driver);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Register ─────────────────────────────────────────────────────────────
  const handlePhotoChange = (field, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (field === 'driverPhoto') {
        setDriverPhotoFile(file);
        setDriverPhotoPreview(reader.result);
      } else {
        setCarPhotoFile(file);
        setCarPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const { name, email, phone, address, carType, carNumber } = registerForm;
    if (!name || !email || !phone) {
      setError('Name, email and phone are required');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('phone', phone);
      if (address) formData.append('address', address);
      if (carType) formData.append('carType', carType);
      if (carNumber) formData.append('carNumber', carNumber);
      if (driverPhotoFile) formData.append('driverPhoto', driverPhotoFile);
      if (carPhotoFile) formData.append('carPhoto', carPhotoFile);

      await driverRegister(formData);
      setRegistered(true);
      toast.success('Registered! Use the Login tab to sign in with OTP.');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Shared styles ────────────────────────────────────────────────────────
  const photoBoxStyle = {
    border: '2px dashed rgba(0,212,255,0.3)',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'rgba(0,212,255,0.04)',
    transition: 'border-color 0.2s',
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Close */}
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
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚖</div>
          <h2 style={{ fontWeight: 700, fontSize: '1.4rem' }}>Driver Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Udupi Taxi — Driver Access
          </p>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { id: 'login', label: 'Login' },
            { id: 'register', label: 'Register' },
          ].map(t => (
            <button
              key={t.id}
              className={`tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
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

        {/* ── Login Tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'login' && (
          <div>
            <div className="input-group">
              <label>Email Address</label>
              <input
                className="input"
                type="email"
                placeholder="your@email.com"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                disabled={otpSent}
                autoFocus
              />
            </div>

            {!otpSent ? (
              <button
                className="btn btn-primary"
                onClick={handleSendOTP}
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', fontWeight: 600 }}
              >
                {loading ? <span className="spinner" /> : '📧 Send OTP'}
              </button>
            ) : (
              <>
                <div className="input-group" style={{ marginTop: '0.5rem' }}>
                  <label>Enter OTP (6 digits)</label>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { setOtpSent(false); setOtpCode(''); }}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    ← Change Email
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleVerifyOTP}
                    disabled={loading}
                    style={{ flex: 2, justifyContent: 'center', fontWeight: 600 }}
                  >
                    {loading ? <span className="spinner" /> : '✓ Verify OTP'}
                  </button>
                </div>
              </>
            )}

            <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              New driver?{' '}
              <button
                type="button"
                onClick={() => handleTabChange('register')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Register here
              </button>
            </p>
          </div>
        )}

        {/* ── Register Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'register' && (
          registered ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Registration Successful!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Your account has been created. Go to the Login tab and use your email to receive an OTP.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => handleTabChange('login')}
                style={{ justifyContent: 'center' }}
              >
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister}>
              {/* Personal Details */}
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Personal Details
              </p>

              <div className="input-group">
                <label>Full Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Ramesh Kumar"
                  value={registerForm.name}
                  onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label>Email Address *</label>
                <input
                  className="input"
                  type="email"
                  placeholder="your@email.com"
                  value={registerForm.email}
                  onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label>Phone Number *</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={registerForm.phone}
                  onChange={e => setRegisterForm(p => ({ ...p, phone: e.target.value }))}
                  required
                />
              </div>
              <div className="input-group">
                <label>Address</label>
                <input
                  className="input"
                  placeholder="Your residential address"
                  value={registerForm.address}
                  onChange={e => setRegisterForm(p => ({ ...p, address: e.target.value }))}
                />
              </div>

              {/* Vehicle Details */}
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '1rem 0 0.75rem' }}>
                Vehicle Details
              </p>

              <div className="input-group">
                <label>Vehicle Type</label>
                <select
                  className="input"
                  value={registerForm.carType}
                  onChange={e => setRegisterForm(p => ({ ...p, carType: e.target.value }))}
                  style={{ background: 'var(--card)', color: 'var(--text-light)' }}
                >
                  <option value="">Select vehicle type</option>
                  {CAR_TYPES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Car Registration Number</label>
                <input
                  className="input"
                  placeholder="e.g. KA-20-AB-1234"
                  value={registerForm.carNumber}
                  onChange={e => setRegisterForm(p => ({ ...p, carNumber: e.target.value }))}
                />
              </div>

              {/* Photos */}
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '1rem 0 0.75rem' }}>
                Photos
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                {/* Driver Photo */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                    Your Photo
                  </label>
                  <label style={photoBoxStyle}>
                    {driverPhotoPreview ? (
                      <img
                        src={driverPhotoPreview}
                        alt="Driver"
                        style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '0.35rem' }}
                      />
                    ) : (
                      <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <div style={{ fontSize: '1.5rem' }}>👤</div>
                        <div>Upload Photo</div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handlePhotoChange('driverPhoto', e.target.files[0])}
                    />
                  </label>
                </div>

                {/* Car Photo */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                    Car Photo
                  </label>
                  <label style={photoBoxStyle}>
                    {carPhotoPreview ? (
                      <img
                        src={carPhotoPreview}
                        alt="Car"
                        style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '0.35rem' }}
                      />
                    ) : (
                      <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <div style={{ fontSize: '1.5rem' }}>🚗</div>
                        <div>Upload Photo</div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handlePhotoChange('carPhoto', e.target.files[0])}
                    />
                  </label>
                </div>
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', fontWeight: 600, marginTop: '0.5rem' }}
              >
                {loading ? <span className="spinner" /> : '🚖 Register as Driver'}
              </button>

              <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Login here
                </button>
              </p>
            </form>
          )
        )}
      </div>
    </div>
  );
}
