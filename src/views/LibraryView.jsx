import React from 'react';
import { useStore, filteredBooks, importFolders } from '../lib/store.js';
import { IconBooksDocs, IconPlus } from '../lib/icons.jsx';
import BookCard, { BookTile } from '../components/BookCard.jsx';

/** Readera's "Books & documents" — a list of rows, or a cover thumbnail grid. */
export default function LibraryView() {
  const layout = useStore((s) => s.layout);
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
