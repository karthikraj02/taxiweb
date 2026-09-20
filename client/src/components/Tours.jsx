import React from 'react';
import { Check, Clock } from './Icons.jsx';
import TourArt from './TourArt.jsx';

// Optional real photos: drop files named after the tour slug into src/img/tours/
// (e.g. temple-circuit.jpg, beach-tour.jpg, western-ghats.jpg, mangalore-city.jpg).
const photos = import.meta.glob('../img/tours/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });
const photoFor = (slug) => {
  const key = Object.keys(photos).find(k => k.split('/').pop().replace(/\.[^.]+$/, '') === slug);
  return key ? photos[key] : null;
};
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const TOURS = [
  { name: 'Temple Circuit', price: '₹3,500', duration: 'Full day · 10 hrs', highlights: ['Udupi Krishna Temple', 'Kollur Mookambika', 'Sringeri Sharada'], desc: 'The divine temples of coastal Karnataka in a single spiritual journey.' },
  { name: 'Beach Tour', price: '₹2,800', duration: 'Half day · 6 hrs', highlights: ['Malpe Beach', "St. Mary's Island", 'Kaup Lighthouse'], desc: 'Beaches and scenic coastline across Udupi district.' },
  { name: 'Western Ghats', price: '₹4,200', duration: 'Full day · 12 hrs', highlights: ['Agumbe', 'Kudremukh', 'Chikmagalur'], desc: 'Waterfalls, wildlife and green hill country in the Western Ghats.' },
  { name: 'Mangalore City', price: '₹2,200', duration: 'Half day · 5 hrs', highlights: ['Panambur Beach', 'Mangala Devi Temple', 'Sultan Battery'], desc: 'A curated day in Mangalore: culture, coast and cuisine.' },
];

const DESTINATIONS = [
  'Mangalore', 'Bangalore', 'Goa', 'Mysore', 'Coorg', 'Hampi',
  'Gokarna', 'Shimoga', 'Hassan', 'Chikmagalur', 'Kundapur',
];

export default function Tours({ onEnquire, onDestination }) {
  return (
    <div className="section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Tour packages</span>
          <h2 className="section-title">Day trips across Karnataka</h2>
          <p className="section-subtitle">Ready-made itineraries with a driver who knows the roads.</p>
        </div>

        <div className="tour-grid">
          {TOURS.map(tour => {
            const slug = slugify(tour.name);
            const photo = photoFor(slug);
            return (
            <article key={tour.name} className="tour">
              <div className="tour-media">
                {photo ? <img src={photo} alt={tour.name} loading="lazy" /> : <TourArt slug={slug} />}
              </div>
              <div className="tour-body">
              <div className="tour-meta"><Clock size={15} /> {tour.duration}</div>
              <h3>{tour.name}</h3>
              <p>{tour.desc}</p>
              <ul>
                {tour.highlights.map(h => <li key={h}><Check size={16} /> {h}</li>)}
              </ul>
              <div className="tour-foot">
                <div className="price">{tour.price}<small>per vehicle</small></div>
                <button className="btn btn-dark btn-sm" onClick={onEnquire}>Enquire</button>
              </div>
              </div>
            </article>
            );
          })}
        </div>

        <div className="section-head" style={{ marginBottom: '1.5rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.4rem' }}>Popular destinations from Udupi</h3>
          <p className="section-subtitle" style={{ fontSize: '0.95rem' }}>Select a destination to start a booking.</p>
        </div>
        <div className="chips" style={{ justifyContent: 'center' }}>
          {DESTINATIONS.map(d => (
            <button key={d} className="chip" onClick={() => onDestination(d)}>{d}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
