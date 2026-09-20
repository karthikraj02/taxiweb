import React, { useState } from 'react';
import {
  driverRegister, driverUploadDocuments, driverRequestOTP, driverVerifyOTP,
  unwrap, apiError,
} from '../api/index.js';
import { useDriver } from '../context/DriverContext.jsx';
import toast from 'react-hot-toast';
import { Logo, Check } from './Icons.jsx';

const CAR_TYPES = [
  { value: 'etios', label: 'Toyota Etios' },
  { value: 'dzire', label: 'Maruti Dzire' },
  { value: 'innova', label: 'Toyota Innova' },
  { value: 'tempo', label: 'Tempo Traveller' },
];

export default function DriverAuthModal({ onClose, onLoginSuccess }) {
  const { loginDriver, isDriverAuthenticated } = useDriver();
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
      await driverRequestOTP(loginEmail);
      setOtpSent(true);
      toast.success('If that email is registered, a code has been sent.');
    } catch (err) {
      setError(apiError(err, 'Could not send the code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode) { setError('Please enter the OTP'); return; }
    setError('');
    setLoading(true);
    try {
      const data = unwrap(await driverVerifyOTP(loginEmail, otpCode));
      toast.success(`Welcome, ${data.driver?.name || 'Driver'}.`);
      // canAcceptRides is separate from being signed in: a driver awaiting
      // admin approval can log in but cannot receive rides.
      loginDriver(data.driver, data.canAcceptRides);
      if (onLoginSuccess) onLoginSuccess(data.driver);
      onClose();
    } catch (err) {
      setError(apiError(err, 'That code was not accepted.'));
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
      // Step 1 — create the account. Documents are uploaded separately, on an
      // authenticated endpoint, because the driver must prove control of the
      // email address before submitting identity documents.
      await driverRegister({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        ...(address?.trim() ? { address: address.trim() } : {}),
        ...(carType ? { carType } : {}),
        ...(carNumber?.trim() ? { carNumber: carNumber.trim() } : {}),
      });

      setRegistered(true);
      toast.success('Registered. Sign in with the code sent to your email, then upload your documents.');
    } catch (err) {
      setError(apiError(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Document upload, available once signed in. Replaces the old flow where
   * photos rode along with registration and a successful OTP alone made the
   * driver "verified".
   */
  const handleUploadDocuments = async () => {
    if (!driverPhotoFile && !carPhotoFile) {
      setError('Attach at least one document.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      if (driverPhotoFile) formData.append('driver_photo', driverPhotoFile);
      if (carPhotoFile) formData.append('vehicle_photo', carPhotoFile);
      await driverUploadDocuments(formData);
      toast.success('Documents uploaded. An admin will review your account.');
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not upload your documents.'));
    } finally {
      setLoading(false);
    }
  };

  // ─── Shared styles ────────────────────────────────────────────────────────
  const photoBoxStyle = {
    border: '2px dashed var(--line-strong)',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'var(--bg-soft)',
    transition: 'border-color 0.2s',
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Close */}
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="logo-wrap"><Logo size={44} /></div>
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
          <div className="alert-error" role="alert">{error}
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
                {loading ? <span className="spinner" /> : 'Send OTP'}
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
                    Change Email
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleVerifyOTP}
                    disabled={loading}
                    style={{ flex: 2, justifyContent: 'center', fontWeight: 600 }}
                  >
                    {loading ? <span className="spinner" /> : 'Verify OTP'}
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
              <div className="success-mark"><Check size={30} /></div>
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Registration received</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                Your account has been created. There are two more steps before you can accept rides:
              </p>
              <ol style={{
                textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.85rem',
                lineHeight: 1.8, margin: '0 auto 1.25rem', maxWidth: '320px', paddingLeft: '1.2rem',
              }}>
                <li>Sign in with the code sent to your email.</li>
                <li>Upload your documents — an admin then verifies your account.</li>
              </ol>

              {/*
                Documents are uploaded on an authenticated endpoint, so this is
                only offered once signed in. Previously photos rode along with
                registration and a passing OTP alone marked a driver verified.
              */}
              {isDriverAuthenticated ? (
                <>
                  {(driverPhotoFile || carPhotoFile) ? (
                    <button
                      className="btn btn-primary"
                      onClick={handleUploadDocuments}
                      disabled={loading}
                      style={{ justifyContent: 'center', width: '100%' }}
                    >
                      {loading ? 'Uploading…' : 'Upload my documents'}
                    </button>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Attach a driver photo and a vehicle photo on the form to upload them.
                    </p>
                  )}
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => handleTabChange('login')}
                  style={{ justifyContent: 'center', width: '100%' }}
                >
                  Continue to sign in
                </button>
              )}
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
                        <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>+</div>
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
                        <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>+</div>
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
                {loading ? <span className="spinner" /> : 'Register as Driver'}
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
