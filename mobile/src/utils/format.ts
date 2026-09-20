export const money = (n: number | undefined | null) =>
  n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`;

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Mirrors the server-side booking state machine (see server/constants/bookingStates.js). */
export const STATUS_STEPS: { key: string; label: string; desc: string }[] = [
  { key: 'pending', label: 'Booked', desc: 'Awaiting payment' },
  { key: 'payment_pending', label: 'Payment', desc: 'Complete payment to confirm' },
  { key: 'confirmed', label: 'Confirmed', desc: 'Payment received' },
  { key: 'dispatching', label: 'Finding a driver', desc: 'Contacting nearby drivers' },
  { key: 'driver_assigned', label: 'Driver assigned', desc: 'A driver has accepted' },
  { key: 'driver_en_route', label: 'En route', desc: 'Driver is on the way' },
  { key: 'driver_arrived', label: 'Arrived', desc: 'Driver is at your pickup' },
  { key: 'in_progress', label: 'Trip started', desc: 'Enjoy your ride' },
  { key: 'completed', label: 'Completed', desc: 'Trip finished. Thank you!' },
];

export const TERMINAL_STATUS: Record<string, string> = {
  cancelled: 'Cancelled',
  payment_failed: 'Payment failed',
  expired: 'Expired',
};

export function statusLabel(status: string): string {
  return TERMINAL_STATUS[status] ?? STATUS_STEPS.find((s) => s.key === status)?.label ?? status;
}

/** Statuses in which the customer can still cancel (before the trip starts). */
export const CANCELLABLE = ['pending', 'payment_pending', 'confirmed', 'dispatching', 'driver_assigned', 'driver_en_route'];

export const ACTIVE_STATUSES = [
  'pending', 'payment_pending', 'confirmed', 'dispatching',
  'driver_assigned', 'driver_en_route', 'driver_arrived', 'in_progress',
];

const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Next days as pickers: today plus 13 more. */
export function nextDays(count = 14): { key: string; label: string; sub: string }[] {
  const out: { key: string; label: string; sub: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      key: localKey(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      sub: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    });
  }
  return out;
}

/** Half-hourly pickup times from 05:00 to 23:30. */
export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 5; h <= 23; h++) for (const m of ['00', '30']) slots.push(`${String(h).padStart(2, '0')}:${m}`);
  return slots;
})();

/**
 * Pickup times still bookable on a date. For today, slots that have passed (or are
 * less than 20 minutes away) are removed so a rider can never choose a past time.
 */
export function timeSlotsFor(dateKey: string, now: Date = new Date()): string[] {
  if (dateKey !== localKey(now)) return TIME_SLOTS;
  const cutoff = now.getTime() + 20 * 60 * 1000;
  return TIME_SLOTS.filter((t) => new Date(`${dateKey}T${t}:00`).getTime() > cutoff);
}

export const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
};

/** Combines a YYYY-MM-DD date and HH:MM time (device local time) into an ISO instant. */
export function toISO(date: string, time: string): string | null {
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
