import React from 'react';

export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="shoso-book-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="6" y="4" width="30" height="40" rx="4" fill="url(#shoso-book-grad)" opacity="0.95" />
      <path d="M12 12h18M12 18h18M12 24h12" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M36 10c2.5 0 4.5 1 6 2.5V42c-1.5-1.5-3.5-2.5-6-2.5" fill="#38bdf8" opacity="0.9" />
    </svg>
  );
}
