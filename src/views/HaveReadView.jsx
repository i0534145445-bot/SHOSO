import React from 'react';
import { useStore, haveReadBooks, setView } from '../lib/store.js';
import { IconDoubleCheck } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';

/** Readera's "Have Read" list. */
export default function HaveReadView() {
  const books = haveReadBooks();

  if (!books.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><IconDoubleCheck size={52} /></div>
        <h2>עוד לא סימנת ספרים כנקראו</h2>
        <p>לחץ על סימן ה-V הכפול ליד ספר כדי לסמן אותו כנקרא.</p>
        <div className="empty-actions">
          <button className="btn ghost small" onClick={() => setView('books')}>לספרייה</button>
        </div>
      </div>
    );
  }

  return (
    <div className="book-list">
      {books.map((b) => <BookCard key={b.id} book={b} from="haveread" />)}
    </div>
  );
}
