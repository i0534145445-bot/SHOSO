import React from 'react';
import { useStore, toReadBooks, setView } from '../lib/store.js';
import { IconClock } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';

/** Readera's "To Read" list. */
export default function ToReadView() {
  const toRead = useStore((s) => s.toRead);
  const books = toReadBooks();

  if (!books.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><IconClock size={52} /></div>
        <h2>רשימת "לקריאה" ריקה</h2>
        <p>לחץ על סמל השעון ליד ספר כדי לשמור אותו לרשימת הקריאה הבאה.</p>
        <div className="empty-actions">
          <button className="btn ghost small" onClick={() => setView('books')}>לספרייה</button>
        </div>
      </div>
    );
  }

  return (
    <div className="book-list">
      {books.map((b) => <BookCard key={b.id} book={b} from="toread" />)}
      {toRead.length === 0 && null}
    </div>
  );
}
