import React from 'react';
import {
  useStore, continuingBooks, importFolders, setView,
} from '../lib/store.js';
import { IconReadingNow, IconPlus } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';

/**
 * Readera's landing screen: "Reading Now" — the books you have open, each one
 * a row with its progress rail, followed by everything else in the library.
 */
export default function HomeView() {
  const books = useStore((s) => s.books);
  const inProgress = continuingBooks();
  const started = new Set(inProgress.map((b) => b.id));

  if (!books.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><IconReadingNow size={54} /></div>
        <h2>ברוך הבא ל-SHOSO Books</h2>
        <p>
          קורא ספרים שולחני כמו Readera — EPUB, PDF, FB2, TXT, DOCX ו-Markdown.
          הוסף תיקיות ספרים כדי להתחיל לקרוא.
        </p>
        <div className="empty-actions">
          <button className="btn primary large" onClick={importFolders}>
            <IconPlus size={18} /> הוסף תיקיות ספרים
          </button>
          <button className="btn ghost large" onClick={() => setView('books')}>
            עבור לספרייה
          </button>
        </div>
      </div>
    );
  }

  const rest = books.filter((b) => !started.has(b.id)).slice(0, 12);

  return (
    <div className="home-view">
      {inProgress.length > 0 && (
        <>
          <h2 className="section-title">המשך קריאה</h2>
          <div className="book-list">
            {inProgress.map((b) => <BookCard key={b.id} book={b} from="home" />)}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <div className="section-head">
            <h2>{inProgress.length ? 'עוד בספרייה' : 'בספרייה'}</h2>
            <button className="btn ghost small" onClick={() => setView('books')}>הצג הכול</button>
          </div>
          <div className="book-list">
            {rest.map((b) => <BookCard key={b.id} book={b} from="home" />)}
          </div>
        </>
      )}
    </div>
  );
}
