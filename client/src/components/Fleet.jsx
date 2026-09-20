import React from 'react';
import etiosImg from '../img/etios.png';
import dzireImg from '../img/maruti_desire.png';
import innovaImg from '../img/toyota_innova.png';
import tempoImg from '../img/tt.png';
import { Users, Bag } from './Icons.jsx';

const CARS = [
  { id: 'etios', name: 'Toyota Etios', image: etiosImg, seats: 4, luggage: '2 bags', rate: '₹12/km', min: '₹600', features: ['AC', 'GPS', 'Music system'] },
  { id: 'dzire', name: 'Maruti Dzire', image: dzireImg, seats: 4, luggage: '2 bags', rate: '₹13/km', min: '₹650', features: ['AC', 'GPS', 'Comfortable'] },
  { id: 'innova', name: 'Toyota Innova', image: innovaImg, seats: 7, luggage: '4 bags', rate: '₹18/km', min: '₹1,100', features: ['AC', 'GPS', 'Spacious'] },
  { id: 'tempo', name: 'Tempo Traveller', image: tempoImg, seats: 12, luggage: '8 bags', rate: '₹25/km', min: '₹2,500', features: ['AC', 'GPS', 'Group travel'] },
];

export default function Fleet({ onBookNow }) {
  return (
    <div className="section section-soft">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Our fleet</span>
          <h2 className="section-title">Choose the right vehicle</h2>
          <p className="section-subtitle">From solo trips to group travel, every vehicle is air-conditioned and well maintained.</p>
        </div>

        <div className="fleet-grid">
          {CARS.map(car => (
            <article key={car.id} className="vehicle">
              <div className="vehicle-img"><img src={car.image} alt={car.name} loading="lazy" /></div>
              <div className="vehicle-body">
                <h3>{car.name}</h3>
                <div className="vehicle-specs">
                  <span><Users size={16} /> {car.seats} seats</span>
                  <span><Bag size={16} /> {car.luggage}</span>
                </div>
                <div className="vehicle-tags">
                  {car.features.map(f => <span key={f} className="tag">{f}</span>)}
                </div>
                <div className="vehicle-foot">
                  <div className="price">{car.rate}<small>Minimum {car.min}</small></div>
                  <button className="btn btn-dark btn-sm" onClick={() => onBookNow(car.id)}>Book now</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
