import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../hooks/useApi';
import { getCsrfToken } from '../utils/csrfToken';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fetch the CSRF token as soon as the form mounts so the first submission
  // can be sent without an extra round-trip.
  useEffect(() => {
    getCsrfToken().catch(() => {
      // Silently ignore pre-fetch errors; the interceptor will retry on submit.
    });
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', form);
      // Store the access token returned by the server (if any) and redirect.
      if (data.accessToken) {
        sessionStorage.setItem('accessToken', data.accessToken);
      }
      navigate('/dashboard');
    } catch (err) {
      const message =
        err.response?.data?.message ||
        'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form} noValidate>
        <h2 style={styles.heading}>Sign In</h2>

        {error && <p style={styles.error}>{error}</p>}

        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="jane@example.com"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="Your password"
          />
        </label>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p style={styles.registerLink}>
          Don&apos;t have an account? <a href="/register">Create one</a>
        </p>
      </form>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
  },
  form: {
    background: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  heading: {
    margin: 0,
    fontSize: '1.5rem',
    textAlign: 'center',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '0.875rem',
    gap: '0.25rem',
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  button: {
    padding: '0.75rem',
    background: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  error: {
    color: '#e00',
    margin: 0,
    fontSize: '0.875rem',
  },
  registerLink: {
    textAlign: 'center',
    fontSize: '0.875rem',
    margin: 0,
  },
};
