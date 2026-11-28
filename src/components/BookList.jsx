import React, { memo, useRef } from 'react';
import { useStore } from '../lib/store.js';
import BookCard, { BookTile } from './BookCard.jsx';
import VirtualGrid from './VirtualGrid.jsx';
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

const BookBrief = memo(BookBriefBase);

/**
 * Renders a set of books using whichever library view is selected – shared by
 * Books & documents, Favorites, To read, Have read, Authors, Formats, Shelves…
 */
export default function BookList({ books, from = 'books' }) {
  const layout = useStore((s) => s.layout);

  if (!books.length) return null;

  const keyOf = (b) => b.id;

  if (layout === 'thumbs') {
    return (
      <VirtualGrid
        items={books}
        keyOf={keyOf}
        className="thumbs"
        minColumnWidth={112}
        gapX={14}
        gapY={18}
        paddingX={16}
        estimateRowHeight={220}
        itemSelector=".book-tile"
        renderItem={(b) => <BookTile key={b.id} book={b} from={from} size="xs" />}
      />
    );
  }

  if (layout === 'grid') {
    return (
      <VirtualGrid
        items={books}
        keyOf={keyOf}
        className="tiles"
        minColumnWidth={232}
        gapX={22}
        gapY={24}
        paddingX={18}
        estimateRowHeight={380}
        itemSelector=".book-tile"
        renderItem={(b) => <BookTile key={b.id} book={b} from={from} size="md" />}
      />
    );
  }

  if (layout === 'brief') {
    return (
      <VirtualGrid
        items={books}
        keyOf={keyOf}
        className="brief"
        singleColumn
        estimateRowHeight={56}
        itemSelector=".brief-row"
        renderItem={(b) => <BookBrief key={b.id} book={b} from={from} />}
      />
    );
  }

  return (
    <VirtualGrid
      items={books}
      keyOf={keyOf}
      className="rows"
      minColumnWidth={300}
      gapX={8}
      gapY={8}
      paddingX={8}
      estimateRowHeight={142}
      itemSelector=".book-row"
      renderItem={(b) => <BookCard key={b.id} book={b} from={from} />}
    />
  );
}
