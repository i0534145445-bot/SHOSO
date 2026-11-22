import React from 'react';
import { useStore } from '../lib/store.js';
import BookCard, { BookTile } from './BookCard.jsx';
import Cover from './Cover.jsx';
import { openBookFrom } from '../lib/store.js';
import { formatSize } from '../lib/format.js';

/** ReadEra's four library views, in its order. */
export const VIEW_MODES = [
  { id: 'full', label: 'תצוגה מלאה', hint: 'כריכה, פרטים ופעולות' },
  { id: 'brief', label: 'תצוגה תמציתית', hint: 'שורה קצרה לכל ספר' },
  { id: 'thumbs', label: 'תמונות ממוזערות', hint: 'כריכות קטנות' },
  { id: 'grid', label: 'כריכות', hint: 'כריכות גדולות' },
];

/** Compact row used by the "brief" view – cover, title and author on one line. */
function BookBrief({ book, from }) {
  const progress = useStore((s) => s.progress[book.id]);
  const percent = Math.round(progress?.percent || 0);
  return (
    <button className="brief-row" onClick={() => openBookFrom(book.id, from)} title={book.title}>
      <span className="brief-cover"><Cover book={book} size="xs" /></span>
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
export default function BookList({ books, from = 'books' }) {
  const layout = useStore((s) => s.layout);

  if (!books.length) return null;

  if (layout === 'thumbs') {
    return (
      <div className="book-grid thumbs">
        {books.map((b) => <BookTile key={b.id} book={b} from={from} size="xs" />)}
      </div>
    );
  }

  if (layout === 'grid') {
    return (
      <div className="book-grid tiles">
        {books.map((b) => <BookTile key={b.id} book={b} from={from} size="md" />)}
      </div>
    );
  }

  if (layout === 'brief') {
    return (
      <div className="book-list brief">
        {books.map((b) => <BookBrief key={b.id} book={b} from={from} />)}
      </div>
    );
  }

  return (
    <div className="book-list">
      {books.map((b) => <BookCard key={b.id} book={b} from={from} />)}
    </div>
  );
}
