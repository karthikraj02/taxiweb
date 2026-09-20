import api, { unwrap } from './client';
import type {
  AssignedRide, Booking, CarType, Coords, DriverProfile, PaymentOrder, Quote,
  Review, RideRequest, Tariff, TripType, User,
} from '../types';

export interface TripInput {
  pickup: string;
  drop: string;
  pickupCoords: Coords;
  dropCoords: Coords;
  carType: CarType;
  tripType: TripType;
  scheduledFor: string; // ISO
  passengerCount: number;
  notes?: string;
}

// ------------------------------------------------------------- customer auth
export const login = async (email: string, password: string) =>
  unwrap<{ user: User }>(await api.post('/api/auth/login', { email, password }));

export const register = async (payload: { name: string; email?: string; phone?: string; password: string }) =>
  unwrap<{ user: User }>(await api.post('/api/auth/register', payload));

export const requestOtp = async (phone: string) => unwrap(await api.post('/api/auth/request-otp', { phone }));

export const verifyOtp = async (phone: string, otp: string) =>
  unwrap<{ user: User }>(await api.post('/api/auth/verify-otp', { phone, otp }));

export const getMe = async () => unwrap<{ user: User }>(await api.get('/api/auth/me'));
export const refreshSession = async () => unwrap(await api.post('/api/auth/refresh'));
export const logout = async () => unwrap(await api.post('/api/auth/logout'));
export const forgotPassword = async (email: string) => unwrap(await api.post('/api/auth/forgot-password', { email }));
export const resetPassword = async (email: string, otp: string, newPassword: string) =>
  unwrap(await api.post('/api/auth/reset-password', { email, otp, newPassword }));

// ------------------------------------------------------------------- pricing
export const getTariffs = async () => unwrap<{ tariffs: Tariff[] }>(await api.get('/api/pricing/tariffs'));
export const quoteTrip = async (trip: Omit<TripInput, 'notes'>) =>
  unwrap<Quote>(await api.post('/api/pricing/quote', trip));

// ------------------------------------------------------------------ bookings
export const createBooking = async (trip: TripInput, idempotencyKey: string) =>
  unwrap<{ booking: Booking }>(
    await api.post('/api/bookings', trip, { headers: { 'Idempotency-Key': idempotencyKey } })
  );

export const listBookings = async (page = 1, limit = 20) =>
  unwrap<{ bookings: Booking[]; pagination: { page: number; pages: number; total: number } }>(
    await api.get('/api/bookings', { params: { page, limit } })
  );

export const getBooking = async (id: string) => unwrap<{ booking: Booking }>(await api.get(`/api/bookings/${id}`));

export const cancelBooking = async (id: string, reason?: string) =>
  unwrap<{ booking: Booking; cancellationFee?: number; policy?: string; refundDue?: number }>(
    await api.delete(`/api/bookings/${id}`, { data: reason ? { reason } : {} })
  );

export const dispatchBooking = async (id: string) => unwrap(await api.post(`/api/bookings/${id}/dispatch`));

// ------------------------------------------------------------------ payments
export const createPaymentOrder = async (bookingId: string) =>
  unwrap<PaymentOrder>(await api.post('/api/payments/razorpay/order', { bookingId }));

export const verifyPayment = async (p: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) => unwrap<{ booking: Booking }>(await api.post('/api/payments/razorpay/verify', p));

// ---------------------------------------------------------- contact & reviews
export const sendContactMessage = async (payload: { name: string; email?: string; phone?: string; message: string }) =>
  unwrap(await api.post('/api/contact', payload));

export const getReviews = async () => unwrap<{ reviews: Review[] }>(await api.get('/api/reviews'));

export const submitReview = async (bookingId: string, rating: number, comment?: string) =>
  unwrap(await api.post(`/api/reviews/booking/${bookingId}`, { rating, ...(comment ? { comment } : {}) }));

// --------------------------------------------------------------- driver auth
export interface DriverRegistration {
  name: string;
  email: string;
  phone: string;
  address?: string;
  carType?: CarType;
  carNumber?: string;
}

export const driverRegister = async (payload: DriverRegistration) => unwrap(await api.post('/api/driver-auth/register', payload));
export const driverRequestOtp = async (email: string) => unwrap(await api.post('/api/driver-auth/request-otp', { email }));
export const driverVerifyOtp = async (email: string, otp: string) =>
  unwrap<{ driver: DriverProfile }>(await api.post('/api/driver-auth/verify-otp', { email, otp }));
export const driverLogout = async () => unwrap(await api.post('/api/driver-auth/logout'));
export const getDriverMe = async () => unwrap<{ driver: DriverProfile }>(await api.get('/api/driver-auth/me'));
export const driverRefreshSession = async () => unwrap(await api.post('/api/driver-auth/refresh'));

// ---------------------------------------------------------- driver dashboard
export const getDriverStatus = async () =>
  unwrap<{ approvalStatus: string; isEmailVerified: boolean; canAcceptRides: boolean; documentCount: number; availability: string }>(
    await api.get('/api/driver/status')
  );

export const getDriverRequests = async () =>
  unwrap<{ requests: RideRequest[]; reason?: string }>(await api.get('/api/driver/requests'));

export const acceptRequest = async (id: string) => unwrap<{ booking: AssignedRide }>(await api.post(`/api/driver/requests/${id}/accept`));
export const declineRequest = async (id: string) => unwrap(await api.post(`/api/driver/requests/${id}/decline`));

export const advanceRide = async (id: string, action: 'en_route' | 'arrived' | 'start' | 'complete') =>
  unwrap<{ booking: AssignedRide }>(await api.post(`/api/driver/rides/${id}/advance`, { action }));

export const getDriverStats = async () =>
  unwrap<{
    totalRides: number;
    totalEarnings: number;
    rating: number | null;
    ratingCount: number;
    availability: string;
    activeRide: AssignedRide | null;
  }>(await api.get('/api/driver/stats'));

export const setAvailability = async (availability: 'online' | 'offline') =>
  unwrap<{ availability: string }>(await api.put('/api/drivers/me/availability', { availability }));

export const updateLocation = async (p: { lat: number; lng: number; accuracy?: number; heading?: number; speed?: number }) =>
  unwrap(await api.put('/api/drivers/me/location', p));
