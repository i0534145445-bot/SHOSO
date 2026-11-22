import React, { useState } from 'react';
import {
  useStore, openBookFrom, toggleFavorite, toggleToRead, toggleHaveRead,
  setView, removeBook,
} from '../lib/store.js';
import { formatSize } from '../lib/format.js';
import {
  IconStar, IconClock, IconDoubleCheck, IconBars, IconMore,
  IconInfo, IconTrash, IconCollection,
} from '../lib/icons.jsx';
import Cover from './Cover.jsx';

/**
 * One library row, pixel-matched to Readera:
 *   cover 84×118 · title · author · "FORMAT, size" · hairline rail · 5 actions
 * The five actions are the exact set Readera puts on every row:
 *   star (favourite) · clock (to read) · double-check (have read) ·
 *   reading position · overflow.
 */
export default function BookCard({ book, from = 'books' }) {
  const favorites = useStore((s) => s.favorites);
  const toRead = useStore((s) => s.toRead);
  const progress = useStore((s) => s.progress[book.id]);
  const [menu, setMenu] = useState(false);

  const isFav = favorites.includes(book.id);
  const isToRead = toRead.includes(book.id);
  const percent = Math.round(progress?.percent || 0);
  const isRead = Boolean(progress?.finished) || percent >= 100;

  const open = () => openBookFrom(book.id, from);

  return (
    <article className="book-row" onDoubleClick={open}>
      <div className="row-cover" onClick={open} title="פתח לקריאה">
        <Cover book={book} size="sm" />
      </div>

      <div className="row-main" onClick={open} role="presentation">
        <h3 title={book.title}>{book.title}</h3>
        <p title={book.author}>{book.author || 'מחבר לא ידוע'}</p>
        <p className="row-format">
          {book.format}
          {book.size ? `, ${formatSize(book.size)}` : ''}
        </p>

        <div
          className="row-rail"
          style={{ '--p': `${percent}%` }}
          title={percent > 0 ? `${percent}%` : 'לא התחלת לקרוא'}
        >
          <span style={{ width: `${percent}%` }} />
        </div>

        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className={`icon-btn ${isFav ? 'active' : ''}`}
            title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
            onClick={() => toggleFavorite(book.id)}
          >
            <IconStar size={21} filled={isFav} />
          </button>
          <button
            className={`icon-btn ${isToRead ? 'active' : ''}`}
            title={isToRead ? 'הסר מהרשימה "לקריאה"' : 'הוסף לרשימת "לקריאה"'}
            onClick={() => toggleToRead(book.id)}
          >
            <IconClock size={21} />
          </button>
          <button
            className={`icon-btn ${isRead ? 'active' : ''}`}
            title={isRead ? 'סמן כלא נקרא' : 'סמן כנקרא'}
            onClick={() => toggleHaveRead(book.id)}
          >
            <IconDoubleCheck size={21} />
          </button>
          <button className="icon-btn" title="הוסף למדף" onClick={() => setView('collections')}>
            <IconBars size={21} />
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              title="עוד אפשרויות"
              onClick={() => setMenu((v) => !v)}
            >
              <IconMore size={21} />
            </button>
            {menu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setMenu(false)}
                />
                <div className="row-menu">
                  <button onClick={() => { setMenu(false); setView('book', book.id); }}>
                    <IconInfo size={16} /> פרטי הספר
                  </button>
                  <button onClick={() => { setMenu(false); setView('collections'); }}>
                    <IconCollection size={16} /> הוסף למדף
                  </button>
                  <button className="danger" onClick={() => { setMenu(false); removeBook(book.id); }}>
                    <IconTrash size={16} /> העבר לאשפה
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Cover-first tile used by the "thumbnails" library layout. */
export function BookTile({ book, from = 'books', size = 'md' }) {
  const progress = useStore((s) => s.progress[book.id]);
  const percent = Math.round(progress?.percent || 0);
  return (
    <button className={`book-tile tile-${size}`} onClick={() => openBookFrom(book.id, from)}>
      <Cover book={book} size={size} />
      <h3 title={book.title}>{book.title}</h3>
      <span>{percent > 0 ? `${book.author} · ${percent}%` : book.author}</span>
    </button>
  );
}
