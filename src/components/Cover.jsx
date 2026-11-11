import React from 'react';
import { colorFromString, initials } from '../lib/format.js';

/**
 * Album art with a graceful gradient + initials fallback.
 */
export default function Cover({ src, name = '', size = 56, rounded = 10, className = '', style }) {
  const hue = colorFromString(name);
  const bg = `linear-gradient(135deg, hsl(${hue} 62% 42%), hsl(${(hue + 55) % 360} 68% 26%))`;
  return (
    <div
      className={`cover ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: !src ? bg : undefined,
        ...style,
      }}
    >
      {src ? (
        <img src={src} alt={name} loading="lazy" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <span className="cover-initials" style={{ fontSize: Math.max(10, size * 0.3) }}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}
