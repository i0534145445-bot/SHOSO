import React from 'react';
import { useStore } from '../lib/store.js';
import { IconHeart } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';

export default function FavoritesView() {
  const books = useStore((s) => s.books.filter((b) => s.favorites.includes(b.id)));

  if (!books.length) {
    return (
      <div className="empty-state small">
        <IconHeart size={40} />
        <p>אין ספרים במועדפים עדיין.<br />לחץ על הלב בכרטיס ספר כדי להוסיף.</p>
      </div>
    );
  }

  return (
    <div className="book-grid">
      {books.map((b) => <BookCard key={b.id} book={b} />)}
    </div>
  );
}
