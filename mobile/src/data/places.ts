import type { Coords } from '../types';

export interface Place extends Coords {
  label: string;
}

/**
 * Places a rider can pick. The server prices a trip from coordinates, so a
 * location must resolve to a real position; nothing here is invented. Same
 * list as the website (client/src/utils/geocode.js).
 */
export const PLACES: Place[] = [
  { label: 'Udupi Bus Stand', lat: 13.3409, lng: 74.7421 },
  { label: 'Manipal (KMC)', lat: 13.3525, lng: 74.7868 },
  { label: 'Udupi Railway Station', lat: 13.3486, lng: 74.786 },
  { label: 'Malpe Beach', lat: 13.3494, lng: 74.7043 },
  { label: 'Kaup Beach', lat: 13.2196, lng: 74.7452 },
  { label: 'Padubidri', lat: 13.1447, lng: 74.7714 },
  { label: 'Kundapura', lat: 13.6255, lng: 74.6918 },
  { label: 'Karkala', lat: 13.2154, lng: 74.9938 },
  { label: 'Mangalore Airport (IXE)', lat: 12.9613, lng: 74.89 },
  { label: 'Mangalore Central Station', lat: 12.8654, lng: 74.8426 },
  { label: 'Murudeshwara', lat: 14.0943, lng: 74.4843 },
  { label: 'Gokarna', lat: 14.5479, lng: 74.3188 },
  { label: 'Dharmasthala', lat: 12.9497, lng: 75.38 },
  { label: 'Kollur Mookambika', lat: 13.8639, lng: 74.8145 },
  { label: 'Subrahmanya', lat: 12.6634, lng: 75.6194 },
  { label: 'Mysore Palace', lat: 12.3052, lng: 76.6552 },
  { label: 'Bangalore (Majestic)', lat: 12.9774, lng: 77.5726 },
  { label: "Kempegowda Int'l Airport", lat: 13.1986, lng: 77.7066 },
  { label: 'Goa (Panaji)', lat: 15.4909, lng: 73.8278 },
];

export const POPULAR_ROUTES: { label: string; pickup: string; drop: string }[] = [
  { label: 'Udupi → Mangalore', pickup: 'Udupi Bus Stand', drop: 'Mangalore Central Station' },
  { label: 'Udupi → Airport', pickup: 'Udupi Bus Stand', drop: 'Mangalore Airport (IXE)' },
  { label: 'Udupi → Bangalore', pickup: 'Udupi Bus Stand', drop: 'Bangalore (Majestic)' },
  { label: 'Udupi → Murudeshwara', pickup: 'Udupi Bus Stand', drop: 'Murudeshwara' },
];

export const findPlace = (label: string) => PLACES.find((p) => p.label === label);

export function searchPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase();
  return q ? PLACES.filter((p) => p.label.toLowerCase().includes(q)) : PLACES;
}
