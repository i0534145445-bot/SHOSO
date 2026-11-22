import React, { useState } from 'react';
import {
  useStore, openBookFrom, toggleFavorite, toggleToRead, toggleHaveRead,
  setView, removeBook, toggleSelect, clearSelection,
} from '../lib/store.js';
import { formatSize } from '../lib/format.js';
import {
  IconStar, IconClock, IconDoubleCheck, IconBars, IconMore,
  IconInfo, IconTrash, IconCollection, IconCheck,
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
  const selected = useStore((s) => s.selection.includes(book.id));
  const selecting = useStore((s) => s.selection.length > 0);
  const [menu, setMenu] = useState(false);

  const isFav = favorites.includes(book.id);
  const isToRead = toRead.includes(book.id);
  const percent = Math.round(progress?.percent || 0);
  const isRead = Boolean(progress?.finished) || percent >= 100;

  const open = () => openBookFrom(book.id, from);
  // ReadEra: a tap selects the book (checkbox on the cover, action bar on top),
  // a double clip opens it. The row actions below stop propagation themselves.
  const onRowClick = (event) => {
    if (event.shiftKey) { open(); return; }
    toggleSelect(book.id);
  };

  return (
    <article
      className={`book-row${selected ? ' selected' : ''}`}
      onClick={onRowClick}
      onDoubleClick={open}
      aria-selected={selected}
    >
      <div className="row-cover" title={book.title}>
        <Cover book={book} size="sm" />
        {selecting && (
          <span className={`select-badge${selected ? ' on' : ''}`} aria-hidden="true">
            {selected && <IconCheck size={15} />}
          </span>
        )}
      </div>

      <div className="row-main" role="presentation" onDoubleClick={open}>
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
  const selected = useStore((s) => s.selection.includes(book.id));
  const selecting = useStore((s) => s.selection.length > 0);
  const percent = Math.round(progress?.percent || 0);
  return (
    <button
      className={`book-tile tile-${size}${selected ? ' selected' : ''}`}
      onClick={(event) => {
        if (event.shiftKey) openBookFrom(book.id, from);
        else toggleSelect(book.id);
      }}
      onDoubleClick={() => openBookFrom(book.id, from)}
      aria-selected={selected}
    >
      <span className="tile-cover">
        <Cover book={book} size="md" />
        {selecting && (
          <span className={`select-badge${selected ? ' on' : ''}`} aria-hidden="true">
            {selected && <IconCheck size={15} />}
          </span>
        )}
      </span>
      <h3 title={book.title}>{book.title}</h3>
      <span className="tile-meta">{percent > 0 ? `${book.author} · ${percent}%` : book.author}</span>
    </button>
  );
}
