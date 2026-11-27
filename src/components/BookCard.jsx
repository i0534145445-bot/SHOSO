import React, { useRef, useState } from 'react';
import {
  useStore, openBookFrom, toggleFavorite, toggleToRead, toggleHaveRead,
  setView, removeBook, toggleSelect, openBookDetails,
} from '../lib/store.js';
import { formatSize } from '../lib/format.js';
import {
  IconStar, IconClock, IconDoubleCheck, IconRead, IconMore,
  IconInfo, IconTrash, IconCheck,
} from '../lib/icons.jsx';
import Cover from './Cover.jsx';

/**
 * One library row, pixel-matched to Readera:
 *   cover 84×118 · title · author · "FORMAT, size" · hairline rail · 5 actions
 * The five actions are the exact set Readera puts on every row:
 *   star (favourite) · clock (to read) · double-check (have read) ·
 *   reading position · overflow.
 */
function BookCard({ book, from = 'books' }) {
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

  /* ReadEra's flow: a tap opens the intermediate description screen, the tick
     on the cover (or a long press / ⌘-click, or a second tap once something is
     already selected) picks the book for a multi-book action. */
  const longPress = useRef(null);
  const swallowed = useRef(false);

  const onPointerDown = () => {
    clearTimeout(longPress.current);
    swallowed.current = false;
    longPress.current = setTimeout(() => {
      swallowed.current = true;
      toggleSelect(book.id);
    }, 450);
  };
  const stopPress = () => clearTimeout(longPress.current);

  const onRowClick = (event) => {
    if (swallowed.current) { swallowed.current = false; return; }
    if (event.shiftKey || event.metaKey || event.ctrlKey || selecting) {
      toggleSelect(book.id);
      return;
    }
    openBookDetails(book.id);
  };

  return (
    <article
      className={`book-row${selected ? ' selected' : ''}`}
      onClick={onRowClick}
      onPointerDown={onPointerDown}
      onPointerUp={stopPress}
      onPointerLeave={stopPress}
      onContextMenu={(e) => { e.preventDefault(); toggleSelect(book.id); }}
      aria-selected={selected}
    >
      <div className="row-cover" title={book.title}>
        <Cover book={book} size="sm" />
        <button
          type="button"
          className={`select-tick${selected ? ' on' : ''}${selecting ? ' pinned' : ''}`}
          title={selected ? 'הסר מהבחירה' : 'בחר את הספר'}
          aria-label={selected ? 'הסר מהבחירה' : 'בחר את הספר'}
          onClick={(e) => { e.stopPropagation(); toggleSelect(book.id); }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {selected && <IconCheck size={15} />}
        </button>
      </div>

      <div className="row-main" role="presentation">
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
          <button className="icon-btn" title="פתח לקריאה" onClick={open}>
            <IconRead size={21} />
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
function BookTile({ book, from = 'books', size = 'md' }) {
  const progress = useStore((s) => s.progress[book.id]);
  const selected = useStore((s) => s.selection.includes(book.id));
  const selecting = useStore((s) => s.selection.length > 0);
  const percent = Math.round(progress?.percent || 0);
  const longPress = useRef(null);
  const swallowed = useRef(false);
  return (
    <button
      className={`book-tile tile-${size}${selected ? ' selected' : ''}`}
      onClick={(event) => {
        if (swallowed.current) { swallowed.current = false; return; }
        if (event.shiftKey || event.metaKey || event.ctrlKey || selecting) {
          toggleSelect(book.id);
          return;
        }
        openBookDetails(book.id);
      }}
      onPointerDown={() => {
        clearTimeout(longPress.current);
        swallowed.current = false;
        longPress.current = setTimeout(() => {
          swallowed.current = true;
          toggleSelect(book.id);
        }, 450);
      }}
      onPointerUp={() => clearTimeout(longPress.current)}
      onPointerLeave={() => clearTimeout(longPress.current)}
      onContextMenu={(e) => { e.preventDefault(); toggleSelect(book.id); }}
      aria-selected={selected}
    >
      <span className="tile-cover">
        <Cover book={book} size="md" />
        <span
          role="button"
          tabIndex={0}
          className={`select-tick${selected ? ' on' : ''}${selecting ? ' pinned' : ''}`}
          title={selected ? 'הסר מהבחירה' : 'בחר את הספר'}
          aria-label={selected ? 'הסר מהבחירה' : 'בחר את הספר'}
          onClick={(e) => { e.stopPropagation(); toggleSelect(book.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleSelect(book.id); } }}
        >
          {selected && <IconCheck size={15} />}
        </span>
      </span>
      <h3 title={book.title}>{book.title}</h3>
      <span className="tile-meta">{percent > 0 ? `${book.author} · ${percent}%` : book.author}</span>
    </button>
  );
}

/* A row only changes when its book changes, so a library of hundreds of books
   does not re-render wholesale when something unrelated moves. */
const Same = (a, b) => a.book === b.book && a.from === b.from && a.size === b.size;
const MemoCard = React.memo(BookCard, Same);
const MemoTile = React.memo(BookTile, Same);
export default MemoCard;
export { MemoTile as BookTile };
