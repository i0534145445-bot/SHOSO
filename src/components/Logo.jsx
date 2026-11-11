import React from 'react';

export default function Logo({ size = 34 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SHOSO Music">
      <defs>
        <linearGradient id="shoso-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-1)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#shoso-grad)" />
      <g stroke="#0b0d12" strokeWidth="4.2" strokeLinecap="round">
        <path d="M22 42V24" />
        <path d="M32 48V18" />
        <path d="M42 38V28" />
      </g>
      <circle cx="47.5" cy="17.5" r="3.6" fill="#0b0d12" />
    </svg>
  );
}
