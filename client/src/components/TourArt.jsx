import React from 'react';

// Original flat illustrations used for tour cards.
// If a photo named after the tour exists in src/img/tours/ (e.g. temple-circuit.jpg),
// Tours.jsx uses it instead of the illustration.

const Palm = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 0 Q4 -30 0 -60" stroke="#6b4a2f" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M0 -60 q-22 -6 -34 8 q16 -6 34 -2z M0 -60 q22 -6 34 8 q-16 -6 -34 -2z M0 -60 q-12 -20 -30 -18 q18 2 30 18z M0 -60 q12 -20 30 -18 q-18 2 -30 18z M0 -60 q0 -18 -2 -26 q8 12 2 26z" fill="#2f7d4f" />
  </g>
);

const Temple = () => (
  <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Temple gopuram at sunrise">
    <defs>
      <linearGradient id="sky-t" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd9a0" />
        <stop offset="1" stopColor="#fff1d6" />
      </linearGradient>
    </defs>
    <rect width="400" height="200" fill="url(#sky-t)" />
    <circle cx="300" cy="62" r="34" fill="#f5b301" opacity="0.85" />
    <path d="M0 150 Q100 132 200 148 T400 142 V200 H0z" fill="#e7c48a" />
    {/* gopuram */}
    <g>
      <rect x="150" y="150" width="100" height="28" fill="#b5533c" />
      <rect x="164" y="122" width="72" height="30" fill="#c4614a" />
      <rect x="176" y="98" width="48" height="26" fill="#b5533c" />
      <rect x="186" y="78" width="28" height="22" fill="#c4614a" />
      <path d="M190 78 L200 58 L210 78z" fill="#a6432f" />
      <rect x="199" y="46" width="2" height="14" fill="#7a5600" />
      <circle cx="200" cy="44" r="3" fill="#f5b301" />
      <g fill="#f8e2b8">
        {[158, 174, 190, 206, 222, 238].map(x => <rect key={x} x={x} y="158" width="6" height="20" rx="3" />)}
        {[172, 188, 208, 224].map(x => <rect key={x} x={x} y="130" width="5" height="14" rx="2.5" />)}
        <rect x="197" y="106" width="6" height="12" rx="3" />
      </g>
      <rect x="140" y="176" width="120" height="6" fill="#8f3e2b" />
      <rect x="132" y="182" width="136" height="6" fill="#7a3322" />
    </g>
    <path d="M0 178 H400 V200 H0z" fill="#d9b070" />
    <Palm x={58} y={178} s={1.05} />
    <Palm x={344} y={180} s={0.9} />
  </svg>
);

const Beach = () => (
  <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Beach with lighthouse">
    <defs>
      <linearGradient id="sky-b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#9fd3f2" />
        <stop offset="1" stopColor="#e6f5fd" />
      </linearGradient>
    </defs>
    <rect width="400" height="200" fill="url(#sky-b)" />
    <circle cx="70" cy="52" r="26" fill="#ffd45c" />
    <ellipse cx="250" cy="42" rx="34" ry="9" fill="#fff" opacity="0.9" />
    <ellipse cx="280" cy="50" rx="24" ry="7" fill="#fff" opacity="0.9" />
    <rect y="104" width="400" height="58" fill="#3f9bd0" />
    <path d="M0 118 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#7cc3ea" strokeWidth="2.5" fill="none" />
    <path d="M0 134 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#7cc3ea" strokeWidth="2.5" fill="none" />
    {/* lighthouse on rock */}
    <path d="M262 106 q26 -16 58 0z" fill="#7a6a5a" />
    <path d="M284 104 l4 -46 h14 l4 46z" fill="#fff" />
    <path d="M286 90 h20 l-1 8 h-18z M288.5 72 h15 l-1 8 h-13z" fill="#c4372b" />
    <rect x="286" y="52" width="20" height="8" fill="#0f1b2d" />
    <path d="M284 52 l12 -12 l12 12z" fill="#c4372b" />
    <path d="M0 152 Q120 140 250 152 T400 148 V200 H0z" fill="#f0d9a3" />
    <path d="M0 160 Q120 150 250 160 T400 156" stroke="#fff" strokeWidth="3" opacity="0.7" fill="none" />
    <Palm x={40} y={186} s={1.1} />
    <Palm x={92} y={190} s={0.8} />
  </svg>
);

const Ghats = () => (
  <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Green hills with waterfall">
    <defs>
      <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#cfe8e0" />
        <stop offset="1" stopColor="#eef8f2" />
      </linearGradient>
    </defs>
    <rect width="400" height="200" fill="url(#sky-g)" />
    <circle cx="322" cy="46" r="20" fill="#fff" opacity="0.85" />
    <path d="M0 120 L60 62 L110 104 L170 44 L240 112 L300 70 L400 126 V200 H0z" fill="#8fbfa6" />
    <path d="M0 140 L70 96 L130 130 L200 84 L270 136 L340 100 L400 138 V200 H0z" fill="#4f9a72" />
    {/* waterfall */}
    <path d="M198 88 q3 20 -2 40 q-3 14 2 30 h10 q-4 -16 -1 -30 q5 -20 -2 -40z" fill="#eaf7ff" opacity="0.95" />
    <path d="M0 168 Q100 150 200 164 T400 160 V200 H0z" fill="#2f7d4f" />
    <g fill="#1f5c39">
      {[30, 62, 316, 352].map((x, i) => (
        <path key={x} d={`M${x} ${188 - i % 2 * 4} l-12 0 l12 -34 l12 34z`} />
      ))}
    </g>
    <path d="M0 96 q60 -12 120 0 t120 0 t160 -4" stroke="#fff" strokeWidth="5" opacity="0.5" fill="none" strokeLinecap="round" />
  </svg>
);

const City = () => (
  <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="City skyline by the coast">
    <defs>
      <linearGradient id="sky-c" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f7c9a3" />
        <stop offset="1" stopColor="#fdeedd" />
      </linearGradient>
    </defs>
    <rect width="400" height="200" fill="url(#sky-c)" />
    <circle cx="90" cy="78" r="30" fill="#f5b301" opacity="0.9" />
    <g fill="#3a4a63">
      <rect x="130" y="92" width="34" height="70" />
      <rect x="168" y="70" width="30" height="92" />
      <rect x="202" y="100" width="40" height="62" />
      <rect x="246" y="60" width="28" height="102" />
      <rect x="278" y="88" width="36" height="74" />
      <rect x="318" y="108" width="30" height="54" />
    </g>
    <g fill="#f5d98a">
      {[[138, 102], [150, 102], [138, 118], [150, 118], [176, 82], [176, 98], [176, 114], [254, 74], [254, 90], [254, 106], [286, 98], [300, 98], [286, 114], [300, 114], [210, 112], [226, 112]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="7" height="9" rx="1" />
      ))}
    </g>
    <path d="M0 162 H400 V200 H0z" fill="#3f9bd0" />
    <path d="M0 176 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#7cc3ea" strokeWidth="2.5" fill="none" />
    <path d="M0 190 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#7cc3ea" strokeWidth="2.5" fill="none" />
    <Palm x={36} y={166} s={0.9} />
    <Palm x={372} y={168} s={0.8} />
  </svg>
);

const ART = {
  'temple-circuit': Temple,
  'beach-tour': Beach,
  'western-ghats': Ghats,
  'mangalore-city': City,
};

export default function TourArt({ slug }) {
  const Art = ART[slug];
  return Art ? <Art /> : null;
}
