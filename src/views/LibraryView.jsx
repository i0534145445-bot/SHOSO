import React from 'react';
import { useStore, filteredBooks, setSort, importFolders } from '../lib/store.js';
import { IconSort, IconBooksDocs, IconPlus } from '../lib/icons.jsx';
import BookCard, { BookTile } from '../components/BookCard.jsx';

const SORT_OPTIONS = [
  { key: 'title', label: 'שם' },
  { key: 'author', label: 'מחבר' },
  { key: 'format', label: 'פורמט' },
  { key: 'added', label: 'תאריך הוספה' },
  { key: 'size', label: 'גודל' },
  { key: 'progress', label: 'התקדמות' },
];

/** Readera's "Books & documents" — a list of rows, or a cover thumbnail grid. */
export default function LibraryView() {
  const layout = useStore((s) => s.layout);
  const sort = useStore((s) => s.sort);
  const query = useStore((s) => s.query);
  const books = filteredBooks();

  if (!books.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><IconBooksDocs size={54} /></div>
        <h2>{query ? 'לא נמצאו ספרים תואמים' : 'הספרייה ריקה'}</h2>
        <p>
          {query
            ? 'נסה מילה אחרת מהשם, מהמחבר או מהפורמט.'
            : 'הוסף תיקיית ספרים והם ייכנסו לספרייה אוטומטית — EPUB, PDF, FB2, TXT, DOCX ו-Markdown.'}
        </p>
        {!query && (
          <div className="empty-actions">
            <button className="btn primary" onClick={importFolders}>
              <IconPlus size={16} /> הוסף תיקיית ספרים
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="library-view">
      <div className="toolbar">
        <span className="dim small">
          {books.length} ספרים{query ? ` · "${query}"` : ''}
        </span>
        <label className="sort-label">
          <IconSort size={15} />
          <select value={sort.key} onChange={(e) => setSort({ ...sort, key: e.target.value })}>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button
            className="icon-btn"
            onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
            title="כיוון מיון"
          >
            {sort.dir === 'asc' ? '↑' : '↓'}
          </button>
        </label>
      </div>

      {layout === 'grid' ? (
        <div className="book-grid tiles">
          {books.map((b) => <BookTile key={b.id} book={b} from="books" />)}
        </div>
      ) : (
        <div className="book-list">
          {books.map((b) => <BookCard key={b.id} book={b} from="books" />)}
        </div>
      )}
    </div>
  );
}
