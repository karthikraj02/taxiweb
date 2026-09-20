import type { ImageSourcePropType } from 'react-native';
import type { CarType } from '../types';

export interface Vehicle {
  id: CarType;
  name: string;
  image: ImageSourcePropType;
  seats: number;
  luggage: string;
  rate: string;
  minFare: string;
  features: string[];
}

/** Display copy for the fleet. Prices shown to a rider always come from the server quote. */
export const VEHICLES: Vehicle[] = [
  { id: 'etios', name: 'Toyota Etios', image: require('../../assets/cars/etios.png'), seats: 4, luggage: '2 bags', rate: '₹12/km', minFare: '₹600', features: ['AC', 'GPS', 'Music system'] },
  { id: 'dzire', name: 'Maruti Dzire', image: require('../../assets/cars/maruti_desire.png'), seats: 4, luggage: '2 bags', rate: '₹13/km', minFare: '₹650', features: ['AC', 'GPS', 'Comfortable'] },
  { id: 'innova', name: 'Toyota Innova', image: require('../../assets/cars/toyota_innova.png'), seats: 7, luggage: '4 bags', rate: '₹18/km', minFare: '₹1,100', features: ['AC', 'GPS', 'Spacious'] },
  { id: 'tempo', name: 'Tempo Traveller', image: require('../../assets/cars/tt.png'), seats: 12, luggage: '8 bags', rate: '₹25/km', minFare: '₹2,500', features: ['AC', 'GPS', 'Group travel'] },
];

export const vehicleName = (id: string) => VEHICLES.find((v) => v.id === id)?.name ?? id;

export interface Tour {
  name: string;
  price: string;
  duration: string;
  desc: string;
  highlights: string[];
  image: ImageSourcePropType | null;
}

export const TOURS: Tour[] = [
  {
    name: 'Temple Circuit',
    price: '₹3,500',
    duration: 'Full day · 10 hrs',
    desc: 'The divine temples of coastal Karnataka in a single spiritual journey.',
    highlights: ['Udupi Krishna Temple', 'Kollur Mookambika', 'Sringeri Sharada'],
    image: require('../../assets/tours/temple-circuit.jpg'),
  },
  {
    name: 'Beach Tour',
    price: '₹2,800',
    duration: 'Half day · 6 hrs',
    desc: 'Beaches and scenic coastline across Udupi district.',
    highlights: ['Malpe Beach', "St. Mary's Island", 'Kaup Lighthouse'],
    image: require('../../assets/tours/beach-tour.jpg'),
  },
  {
    name: 'Western Ghats',
    price: '₹4,200',
    duration: 'Full day · 12 hrs',
    desc: 'Waterfalls, wildlife and green hill country in the Western Ghats.',
    highlights: ['Agumbe', 'Kudremukh', 'Chikmagalur'],
    image: require('../../assets/tours/western-ghats.jpg'),
  },
  {
    name: 'Mangalore City',
    price: '₹2,200',
    duration: 'Half day · 5 hrs',
    desc: 'A curated day in Mangalore: culture, coast and cuisine.',
    highlights: ['Panambur Beach', 'Mangala Devi Temple', 'Sultan Battery'],
    image: null,
  },
];
