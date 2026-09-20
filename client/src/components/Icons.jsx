import React from 'react';

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const make = (children) => function Icon({ size = 20, ...rest }) {
  return <svg {...base} width={size} height={size} {...rest}>{children}</svg>;
};

export const Phone = make(<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />);
export const Mail = make(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>);
export const Pin = make(<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>);
export const Clock = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const Users = make(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>);
export const Bag = make(<><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>);
export const Check = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const Shield = make(<><path d="M12 3 5 6v5c0 4.6 3 8.3 7 10 4-1.7 7-5.4 7-10V6z" /><path d="m9 12 2 2 4-4" /></>);
export const Tag = make(<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></>);
export const Route = make(<><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></>);
export const Car = make(<><path d="M5 16v-4l1.6-4A2 2 0 0 1 8.5 6.5h7a2 2 0 0 1 1.9 1.5L19 12v4" /><rect x="4" y="12" width="16" height="6" rx="2" /><circle cx="8" cy="18" r="1" /><circle cx="16" cy="18" r="1" /></>);
export const Star = make(<path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8L3.5 9.7l5.9-.9z" fill="currentColor" stroke="none" />);
export const Menu = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const Close = make(<path d="M6 6l12 12M18 6 6 18" />);
export const Arrow = make(<path d="M5 12h14M13 6l6 6-6 6" />);
export const Send = make(<path d="m4 12 16-8-6 16-2.5-6.5z" />);
export const Chat = make(<path d="M4 5h16v11H9l-5 4z" />);
export const Swap = make(<path d="M4 8h14l-3-3M20 16H6l3 3" />);
export const Facebook = make(<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5c0-.3.2-.5.5-.5z" />);
export const Instagram = make(<><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.5" /><circle cx="17" cy="7" r=".6" fill="currentColor" /></>);
export const Youtube = make(<><rect x="3" y="6" width="18" height="12" rx="3.5" /><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor" /></>);

export function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M7 19v-3l2.2-5.2A2 2 0 0 1 11 9.6h10a2 2 0 0 1 1.8 1.2L25 16v3" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="6" y="16" width="20" height="7" rx="2" fill="var(--ink)" />
      <circle cx="10.5" cy="23" r="2" fill="var(--brand)" stroke="var(--ink)" strokeWidth="1.5" />
      <circle cx="21.5" cy="23" r="2" fill="var(--brand)" stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  );
}
