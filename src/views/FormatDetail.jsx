import React from 'react';
import { useStore, setView } from '../lib/store.js';
import { IconBack } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';

export default function FormatDetail() {
  const format = useStore((s) => s.detailBookId);
  const books = useStore((s) => s.books.filter((b) => b.format === format));

  return (
    <div>
      <button className="btn ghost small" onClick={() => setView('formats')}>
        <IconBack size={15} /> חזרה לפורמטים
      </button>
      <div className="detail-head">
        <span className="author-avatar format large">{format}</span>
        <div>
          <h2>{format}</h2>
          <p className="dim">{books.length} ספרים</p>
        </div>
      </div>
      <div className="book-grid">
        {books.map((b) => <BookCard key={b.id} book={b} />)}
      </div>
    </div>
  );
}
