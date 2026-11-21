import React from 'react';
import { useStore, filteredBooks, setSort } from '../lib/store.js';
import { IconSort, IconBook } from '../lib/icons.jsx';
import BookCard, { BookRow } from '../components/BookCard.jsx';

const SORT_OPTIONS = [
  { key: 'title', label: 'שם' },
  { key: 'author', label: 'מחבר' },
  { key: 'format', label: 'פורמט' },
  { key: 'added', label: 'תאריך הוספה' },
  { key: 'size', label: 'גודל' },
  { key: 'progress', label: 'התקדמות' },
];

export default function LibraryView() {
  const layout = useStore((s) => s.layout);
  const sort = useStore((s) => s.sort);
  const query = useStore((s) => s.query);
  const books = filteredBooks();

  return (
    <div className="library-view">
      <div className="toolbar">
        <span className="dim">{books.length} ספרים{query ? ` עבור "${query}"` : ''}</span>
        <label className="sort-label">
          <IconSort size={15} />
          <select value={sort.key} onChange={(e) => setSort({ ...sort, key: e.target.value })}>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button className="icon-btn" onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })} title="כיוון מיון">
            {sort.dir === 'asc' ? '↑' : '↓'}
          </button>
        </label>
      </div>

      {books.length === 0 ? (
        <div className="empty-state small">
          <IconBook size={40} />
          <p>{query ? 'לא נמצאו ספרים תואמים לחיפוש' : 'הספרייה ריקה – הוסף ספרים כדי להתחיל'}</p>
        </div>
      ) : layout === 'grid' ? (
        <div className="book-grid">
          {books.map((b) => <BookCard key={b.id} book={b} />)}
        </div>
      ) : (
        <div className="book-list">
          {books.map((b) => <BookRow key={b.id} book={b} />)}
        </div>
      )}
    </div>
  );
}
