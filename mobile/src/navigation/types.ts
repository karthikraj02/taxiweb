import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CarType, Coords, PaymentOrder, Quote, TripType } from '../types';

/** A trip the rider has priced but not yet booked. */
export interface TripDraft {
  pickup: string;
  drop: string;
  pickupCoords: Coords;
  dropCoords: Coords;
  carType: CarType;
  tripType: TripType;
  scheduledFor: string; // ISO
  passengerCount: number;
}

export type TabParamList = {
  Home: undefined;
  Book: { pickup?: string; drop?: string; carType?: CarType } | undefined;
  Trips: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Auth: undefined;
  Checkout: { trip: TripDraft; quote: Quote };
  Payment: { bookingId: string; order: PaymentOrder };
  TripDetail: { bookingId: string; notice?: string };
  Tours: undefined;
  Contact: undefined;
  DriverAuth: undefined;
  DriverDashboard: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
