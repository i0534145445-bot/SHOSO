import React from 'react';

/** App mark — a read book on a teal tile, in Readera's icon language. */
export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="8" fill="#005c75" />
      <path
        d="M24 17.5c-2.4-2-5.6-3-9.4-3H11v19h3.6c3.8 0 7 1 9.4 3 2.4-2 5.6-3 9.4-3H37v-19h-3.6c-3.8 0-7 1-9.4 3Z"
        fill="#eaf4f7"
      />
      <path d="M24 17.5v19" stroke="#005c75" strokeWidth="1.6" />
      <path d="M15 21.5h5M15 26h5M28 21.5h5M28 26h5" stroke="#005c75" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M33 6.5c2.6 1 4.6 2.8 5.8 5.4" stroke="#e0a63c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
