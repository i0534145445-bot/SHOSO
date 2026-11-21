import React from 'react';
import { useStore, setView } from '../lib/store.js';
import { initials } from '../lib/format.js';
import { IconBack } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';

export default function AuthorDetail() {
  const author = useStore((s) => s.detailBookId);
  const books = useStore((s) => s.books.filter((b) => b.author === author));

  return (
    <div>
      <button className="btn ghost small" onClick={() => setView('authors')}>
        <IconBack size={15} /> חזרה למחברים
      </button>
      <div className="detail-head">
        <span className="author-avatar large">{initials(author || '?')}</span>
        <div>
          <h2>{author}</h2>
          <p className="dim">{books.length} ספרים בספרייה</p>
        </div>
      </div>
      <div className="book-grid">
        {books.map((b) => <BookCard key={b.id} book={b} />)}
      </div>
    </div>
  );
}
