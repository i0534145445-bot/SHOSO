import React from 'react';
import { colorFromString } from '../lib/format.js';

/** Book cover: real image when available, otherwise a generated gradient cover. */
export default function Cover({ book, size = 'md' }) {
  const hue = colorFromString(book.title + book.author);
  if (book.cover) {
    return (
      <div className={`cover cover-${size} has-img`}>
        <img src={book.cover} alt={book.title} loading="lazy" />
      </div>
    );
  }
  return (
    <div
      className={`cover cover-${size}`}
      style={{ background: `linear-gradient(150deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 60% 18%))` }}
    >
      <span className="cover-format">{book.format}</span>
      <span className="cover-title">{book.title}</span>
      <span className="cover-author">{book.author}</span>
    </div>
  );
}
