import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.js';
import BookCard, { BookTile } from './BookCard.jsx';
import Cover from './Cover.jsx';
import { toggleSelect, openBookDetails } from '../lib/store.js';
import { IconCheck } from '../lib/icons.jsx';
import { formatSize } from '../lib/format.js';

/** ReadEra's four library views, in its order. */
export const VIEW_MODES = [
  { id: 'full', label: 'תצוגה מלאה', hint: 'כריכה, פרטים ופעולות' },
  { id: 'brief', label: 'תצוגה תמציתית', hint: 'שורה קצרה לכל ספר' },
  { id: 'thumbs', label: 'תמונות ממוזערות', hint: 'כריכות קטנות' },
  { id: 'grid', label: 'כריכות', hint: 'כריכות גדולות' },
];

/** Compact row used by the "brief" view – cover, title and author on one line. */
function BookBriefBase({ book, from }) {
  const progress = useStore((s) => s.progress[book.id]);
  const selected = useStore((s) => s.selection.includes(book.id));
  const selecting = useStore((s) => s.selection.length > 0);
  const percent = Math.round(progress?.percent || 0);
  const longPress = useRef(null);
  const swallowed = useRef(false);
  return (
    <button
      className={`brief-row${selected ? ' selected' : ''}`}
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
      title={book.title}
    >
      <span className="brief-cover">
        <Cover book={book} size="xs" />
        <span
          role="button"
          tabIndex={0}
          className={`select-tick small${selected ? ' on' : ''}${selecting ? ' pinned' : ''}`}
          title={selected ? 'הסר מהבחירה' : 'בחר את הספר'}
          aria-label={selected ? 'הסר מהבחירה' : 'בחר את הספר'}
          onClick={(e) => { e.stopPropagation(); toggleSelect(book.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleSelect(book.id); } }}
        >
          {selected && <IconCheck size={12} />}
        </span>
      </span>
      <span className="brief-text">
        <span className="brief-title">{book.title}</span>
        <span className="brief-meta">
          {[book.format, book.size ? formatSize(book.size) : null, book.author || 'ללא מחבר']
            .filter(Boolean).join(' · ')}
          {percent > 0 ? ` · ${percent}%` : ''}
        </span>
      </span>
    </button>
  );
}

/**
 * Renders a set of books using whichever library view is selected – shared by
 * Books & documents, Favorites, To read, Have read, Authors, Formats, Shelves…
 */
/**
 * A library can hold ten thousand books. Rendering them all at once froze the
 * window for seconds and melted memory, so the list paints a first page and
 * keeps loading more as the reader scrolls – the rest is still there, one
 * scroll away, and the counter says exactly what is shown.
 */
const PAGE_SIZE = 120;
const PAGE_STEP = 240;

function usePagedBooks(books, layout, from) {
  const [count, setCount] = useState(PAGE_SIZE);
  const sentinel = useRef(null);
  // Views hand us a fresh array on every render; only a different list (filter,
  // section, view mode, size) may reset the page, or the effect would loop.
  const signature = `${from}|${layout}|${books.length}`;
  const lastSignature = useRef(signature);

  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setCount(PAGE_SIZE);
  }, [signature]);

  const shown = useMemo(
    () => (books.length > count ? books.slice(0, count) : books),
    [books, count],
  );

  useEffect(() => {
    const node = sentinel.current;
    if (!node || shown.length >= books.length) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setCount((prev) => Math.min(books.length, prev + PAGE_STEP));
      }
    }, { rootMargin: '600px' });
    io.observe(node);
    return () => io.disconnect();
  }, [shown.length, books.length]);

  return { shown, sentinel, more: books.length - shown.length };
}

/**
 * The next page loads by itself when this marker scrolls into view – no button,
 * no counter, nothing to click. It keeps a hairline of height so the observer
 * has something to watch.
 */
function Sentinel({ innerRef }) {
  return <div className="list-sentinel" ref={innerRef} aria-hidden="true" />;
}

export default function BookList({ books, from = 'books' }) {
  const layout = useStore((s) => s.layout);
  const { shown, sentinel, more } = usePagedBooks(books, layout, from);

  if (!books.length) return null;

  if (layout === 'thumbs') {
    return (
      <>
        <div className="book-grid thumbs">
          {shown.map((b) => <BookTile key={b.id} book={b} from={from} size="xs" />)}
        </div>
        {more ? <Sentinel innerRef={sentinel} /> : null}
      </>
    );
  }

  if (layout === 'grid') {
    return (
      <>
        <div className="book-grid tiles">
          {shown.map((b) => <BookTile key={b.id} book={b} from={from} size="md" />)}
        </div>
        {more ? <Sentinel innerRef={sentinel} /> : null}
      </>
    );
  }

  if (layout === 'brief') {
    return (
      <>
        <div className="book-list brief">
          {shown.map((b) => <BookBrief key={b.id} book={b} from={from} />)}
        </div>
        {more ? <Sentinel innerRef={sentinel} /> : null}
      </>
    );
  }

  return (
    <>
      <div className="book-list">
        {shown.map((b) => <BookCard key={b.id} book={b} from={from} />)}
      </div>
      {more ? <Sentinel innerRef={sentinel} /> : null}
    </>
  );
}

/* Same rule as the rows: a brief line only changes with its book. */
const BookBrief = memo(BookBriefBase, (a, b) => a.book === b.book && a.from === b.from);
