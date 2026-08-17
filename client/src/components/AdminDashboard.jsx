import React, { useState, useEffect, useCallback } from 'react';
import {
  getAdminStats, getAdminBookings, getAdminDrivers,
  updateBookingStatus, setDriverApproval,
  unwrap, apiError,
} from '../api/index.js';
import toast from 'react-hot-toast';

/** Legal next statuses per state, mirroring the server state machine. */
const NEXT_STATUSES = {
  pending: ['payment_pending', 'cancelled', 'expired'],
  payment_pending: ['confirmed', 'payment_failed', 'cancelled', 'expired'],
  payment_failed: ['payment_pending', 'cancelled', 'expired'],
  confirmed: ['dispatching', 'cancelled', 'expired'],
  dispatching: ['driver_assigned', 'cancelled', 'expired'],
  driver_assigned: ['driver_en_route', 'dispatching', 'cancelled'],
  driver_en_route: ['driver_arrived', 'cancelled'],
  driver_arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [], cancelled: [], expired: [],
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 20,
      };
      const [statsRes, bookingsRes, driversRes] = await Promise.all([
        getAdminStats(),
        getAdminBookings(params),
        getAdminDrivers(),
      ]);
      setStats(unwrap(statsRes));
      setBookings(unwrap(bookingsRes).bookings || []);
      setDrivers(unwrap(driversRes).drivers || []);
    } catch (err) {
      setError(apiError(err, 'Could not load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (bookingId, newStatus) => {
    try {
      await updateBookingStatus(bookingId, newStatus);
      toast.success('Status updated.');
      fetchData();
    } catch (err) {
      // Illegal transitions are rejected by the server; show why.
      toast.error(apiError(err, 'Could not update that booking.'));
    }
  };

  const decideDriver = async (driverId, decision) => {
    const reason = decision === 'approved'
      ? undefined
      : window.prompt(`Reason for ${decision}:`) || undefined;
    if (decision !== 'approved' && !reason) return;
    try {
      await setDriverApproval(driverId, decision, reason);
      toast.success(`Driver ${decision}.`);
      fetchData();
    } catch (err) {
      toast.error(apiError(err, 'Could not update that driver.'));
    }
  };

  if (loading && !stats) {
    return (
      <div className="section">
        <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
          <span className="spinner" />
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="section">
        <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
          <p style={{ color: '#fca5a5', marginBottom: '1rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchData}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ background: 'var(--bg-dark)', minHeight: '100vh' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Admin <span>Dashboard</span></h2>
          <button className="btn btn-primary" onClick={fetchData}>🔄 Refresh</button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            className={`btn ${activeTab === 'bookings' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('bookings')}
          >
            Bookings
          </button>
          <button
            className={`btn ${activeTab === 'drivers' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('drivers')}
          >
            Drivers Directory
          </button>
        </div>

        {activeTab === 'bookings' ? (
          <div>
            {/* Stats from the server, not derived from one page of results */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                ['Total Bookings', stats?.bookings?.total ?? '—', 'var(--primary)'],
                ['Today', stats?.bookings?.today ?? '—', 'var(--primary)'],
                ['Active Rides', stats?.bookings?.active ?? '—', 'var(--accent)'],
                ['Completed', stats?.bookings?.completed ?? '—', 'var(--accent)'],
                ['Cancelled', stats?.bookings?.cancelled ?? '—', '#f87171'],
                ['Revenue', stats ? `₹${(stats.revenue?.totalPaid || 0).toLocaleString()}` : '—', 'var(--accent)'],
                ['Drivers Online', stats?.drivers?.online ?? '—', 'var(--primary)'],
                ['Pending Approvals', stats?.drivers?.pendingApprovals ?? '—', '#fbbf24'],
              ].map(([label, value, color]) => (
                <div key={label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                className="input" style={{ flex: 1, minWidth: '200px' }}
                placeholder="Search booking ID, pickup or drop…"
                value={search} onChange={e => setSearch(e.target.value)}
                aria-label="Search bookings"
              />
              <select
                className="input" style={{ minWidth: '180px' }}
                value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {Object.keys(NEXT_STATUSES).map(st => (
                  <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                ))}
              </select>
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
                    <tr key={b.bookingId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{b.bookingId}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600 }}>{b.customer?.name || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.customer?.phone || ''}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>{b.pickup} → {b.drop}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.scheduledFor ? new Date(b.scheduledFor).toLocaleString() : '—'} · {b.distanceKm} km</div>
                      </td>
                      <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{b.carType}</td>
                      <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent)' }}>₹{b.fare?.toLocaleString()}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{b.paymentStatus}</div>
                      </td>
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
                        {/* Only legal next states are offered. The server
                            re-validates, so this is convenience, not the control. */}
                        {(NEXT_STATUSES[b.status] || []).length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Final</span>
                        ) : (
                          <select
                            className="input"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                            value=""
                            aria-label={`Change status for ${b.bookingId}`}
                            onChange={(e) => e.target.value && updateStatus(b.bookingId, e.target.value)}
                          >
                            <option value="">Move to…</option>
                            {NEXT_STATUSES[b.status].map(st => (
                              <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        )}
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
        ) : (
          /* Drivers Table */
          <div className="card" style={{ overflowX: 'auto', padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '1rem' }}>Name</th>
                  <th style={{ padding: '1rem' }}>Contact</th>
                  <th style={{ padding: '1rem' }}>Vehicle</th>
                  <th style={{ padding: '1rem' }}>Rating</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(driver => (
                  <tr key={driver.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem' }}>
                      <strong style={{ color: 'var(--text)' }}>{driver.name}</strong>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      {driver.email}<br />
                      {driver.phone}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {driver.carType}<br />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{driver.carNumber}</span>
                    </td>
                    <td style={{ padding: '1rem', color: '#fbbf24' }}>
                      ★ {driver.rating != null ? driver.rating.toFixed(1) : 'N/A'} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({driver.ratingCount || 0})</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: driver.approvalStatus === 'approved' ? 'rgba(6,95,70,0.4)'
                            : driver.approvalStatus === 'suspended' || driver.approvalStatus === 'rejected' ? 'rgba(127,29,29,0.4)'
                            : 'rgba(120,53,15,0.4)',
                          color: driver.approvalStatus === 'approved' ? '#34d399'
                            : driver.approvalStatus === 'suspended' || driver.approvalStatus === 'rejected' ? '#fca5a5'
                            : '#fbbf24',
                          textAlign: 'center',
                        }}>
                          {driver.approvalStatus?.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {driver.availability} · {driver.documents?.length || 0} docs
                          {!driver.isEmailVerified && ' · email unverified'}
                        </span>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {driver.approvalStatus !== 'approved' && (
                            <button
                              onClick={() => decideDriver(driver.id, 'approved')}
                              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Approve
                            </button>
                          )}
                          {driver.approvalStatus === 'approved' && (
                            <button
                              onClick={() => decideDriver(driver.id, 'suspended')}
                              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Suspend
                            </button>
                          )}
                          {driver.approvalStatus === 'pending_review' && (
                            <button
                              onClick={() => decideDriver(driver.id, 'rejected')}
                              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No drivers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
