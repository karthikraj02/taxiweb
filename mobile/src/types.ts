/** Shapes returned by the API (see server/dto/index.js). Only the fields the app uses. */

export type CarType = 'etios' | 'dzire' | 'innova' | 'tempo';
export type TripType = 'one-way' | 'round-trip';

export interface Coords {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'user' | 'admin';
}

export interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  carType?: CarType;
  carNumber?: string;
  rating?: number | null;
  approvalStatus: string;
  isEmailVerified: boolean;
  availability: 'offline' | 'online' | 'busy' | 'on_trip';
  rejectionReason?: string;
}

export interface DriverForCustomer {
  name: string;
  phone?: string;
  carType?: string;
  carNumber?: string;
  rating?: number | null;
}

export interface FareBreakdown {
  baseFare?: number;
  includedKm?: number;
  chargeableKm?: number;
  perKmRate?: number;
  roundTripMultiplier?: number;
  nightSurcharge?: number;
  airportSurcharge?: number;
  tax?: number;
}

export interface Quote {
  fare: number;
  distanceKm: number;
  durationMinutes: number;
  distanceEstimated?: boolean;
  breakdown?: FareBreakdown;
}

export interface Booking {
  id: string;
  bookingId: string;
  pickup: string;
  drop: string;
  scheduledFor: string;
  carType: CarType;
  tripType: TripType;
  passengerCount: number;
  distanceKm?: number;
  fare: number;
  status: string;
  paymentStatus: string;
  driver: DriverForCustomer | null;
  createdAt: string;
}

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  bookingId: string;
}

export interface RideRequest {
  bookingId: string;
  pickup: string;
  drop: string;
  scheduledFor?: string;
  carType: CarType;
  tripType: TripType;
  distanceKm?: number;
  distanceToPickupKm?: number;
  fare?: number;
}

export interface AssignedRide extends RideRequest {
  status: string;
  paymentStatus?: string;
  customer?: { name: string; phone?: string } | null;
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  author: string;
}

export interface Tariff {
  id: CarType;
  label: string;
  baseFare: number;
  perKmRate: number;
  includedKm: number;
  capacity: number;
}
