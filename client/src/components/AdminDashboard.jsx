import React, { useState, useEffect } from 'react';
import { getBookings, updateBookingStatus } from '../api/index.js';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data } = await getBookings();
      setBookings(data.bookings || []);
      
      const s = { total: data.total || 0, pending: 0, completed: 0 };
      data.bookings?.forEach(b => {
        if (b.status === 'pending') s.pending++;
        if (b.status === 'completed') s.completed++;
      });
      setStats(s);
    } catch (err) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      await updateBookingStatus(id, newStatus);
      toast.success('Status updated');
      fetchBookings();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  if (loading) return <div className="section"><div className="container" style={{ textAlign: 'center', padding: '5rem' }}><span className="spinner" /></div></div>;

  return (
    <div className="section" style={{ background: 'var(--bg-dark)', minHeight: '100vh' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Admin <span>Dashboard</span></h2>
          <button className="btn btn-primary" onClick={fetchBookings}>🔄 Refresh</button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Bookings</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{stats.total}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pending</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fbbf24' }}>{stats.pending}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Completed</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{stats.completed}</div>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="card" style={{ overflowX: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '1rem' }}>ID</th>
                <th style={{ padding: '1rem' }}>Customer</th>
                <th style={{ padding: '1rem' }}>Route</th>
                <th style={{ padding: '1rem' }}>Vehicle</th>
                <th style={{ padding: '1rem' }}>Fare</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{b.bookingId}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600 }}>{b.user?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.user?.phone}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.875rem' }}>{b.pickup} → {b.drop}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(b.date).toLocaleDateString()} at {b.time}</div>
                  </td>
                  <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{b.carType}</td>
                  <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent)' }}>₹{b.fare}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600,
                      background: b.status === 'pending' ? 'rgba(245,158,11,0.1)' : b.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                      color: b.status === 'pending' ? '#fbbf24' : b.status === 'completed' ? 'var(--accent)' : 'var(--text-muted)'
                    }}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <select 
                      className="input" 
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                      value={b.status}
                      onChange={(e) => updateStatus(b._id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="driver_assigned">Driver Assigned</option>
                      <option value="en_route">En Route</option>
                      <option value="arrived">Arrived</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No bookings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
