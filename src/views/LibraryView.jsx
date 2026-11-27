import React, { useDeferredValue } from 'react';
import { useStore, filteredBooks, importFolders } from '../lib/store.js';
import { IconBooksDocs, IconPlus } from '../lib/icons.jsx';
import BookList from '../components/BookList.jsx';

/** Readera's "Books & documents" — a list of rows, or a cover thumbnail grid. */
export default function LibraryView() {
  const query = useStore((s) => s.query);
  // Filtering a 2 000-book library on every keystroke must never lag the input,
  // so the list follows a deferred copy of the query.
  const deferredQuery = useDeferredValue(query);
  const books = filteredBooks(deferredQuery);

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
      <BookList books={books} from="books" />
    </div>
  );
}
