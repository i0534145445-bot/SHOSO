import React, { useEffect, useState } from 'react';
import { colorFromString } from '../lib/format.js';
import { cachedCover, coverFor } from '../lib/covers.js';

/**
 * Book cover: the real artwork when the file has one, otherwise a generated
 * cover that reads like a printed book — cloth colours, a hairline frame,
 * a serif title block and the author's name at the foot.
 */
const CLOTH = [
  { bg: '#8f2d24', ink: '#f4e7d6', rule: '#c9a227' },
  { bg: '#23434c', ink: '#eaf0ee', rule: '#c9a227' },
  { bg: '#3c5636', ink: '#f2ecdd', rule: '#d8c9a5' },
  { bg: '#6f5330', ink: '#f7efe0', rule: '#dcc38c' },
  { bg: '#33344d', ink: '#eceaf4', rule: '#b9b3d6' },
  { bg: '#5a2b3b', ink: '#f6e8ea', rule: '#d7a8b4' },
  { bg: '#1f5560', ink: '#e8f2f3', rule: '#8fc3c8' },
  { bg: '#7a3b1f', ink: '#fbeedd', rule: '#e0b382' },
];

export default function Cover({ book, size = 'md' }) {
  // The file's own artwork wins; we extract it on first display and remember it.
  const [src, setSrc] = useState(() => book.cover || cachedCover(book.id) || null);

  useEffect(() => {
    let alive = true;
    if (src) return undefined;
    coverFor(book).then((found) => {
      if (alive && found) setSrc(found);
    });
    return () => { alive = false; };
  }, [book, src]);

  if (src) {
    return (
      <div className={`cover cover-${size} has-img`}>
        <img
          src={src}
          alt={book.title}
          loading="lazy"
          draggable="false"
          onError={() => setSrc(null)}
        />
      </div>
    );
  }

  const key = `${book.title || ''}${book.author || ''}`;
  const cloth = CLOTH[colorFromString(key) % CLOTH.length];
  const serif = "'Frank Ruehl', 'David', Georgia, 'Times New Roman', serif";

  return (
    <div
      className={`cover cover-${size} generated`}
      style={{ background: cloth.bg, color: cloth.ink, fontFamily: serif }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 5,
          border: `1px solid ${cloth.rule}`,
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetBlock: 0,
          insetInlineStart: 0,
          width: 7,
          background: 'linear-gradient(90deg, rgba(0,0,0,.45), rgba(255,255,255,.12) 55%, rgba(0,0,0,.18))',
        }}
      />
      <span className="cover-format">{book.format}</span>
      <span
        className="cover-title"
        style={{ textAlign: 'center', fontSize: size === 'sm' ? 10.5 : 13, letterSpacing: 0.2 }}
      >
        {book.title}
      </span>
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          height: 1,
          background: cloth.rule,
          opacity: 0.7,
          margin: '5px auto 4px',
          width: '46%',
        }}
      />
      <span
        className="cover-author"
        style={{ textAlign: 'center', fontSize: size === 'sm' ? 8 : 10, opacity: 0.85 }}
      >
        {book.author}
      </span>
    </div>
  );
}
