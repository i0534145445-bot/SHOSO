import React from 'react';
import { useStore } from '../lib/store.js';
import { IconStar } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';

/** Readera's "Favorites" list. */
export default function FavoritesView() {
  const favorites = useStore((s) => s.favorites);
  const books = useStore((s) => s.books.filter((b) => favorites.includes(b.id)));

  if (!books.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><IconStar size={52} /></div>
        <h2>אין מועדפים עדיין</h2>
        <p>לחץ על כוכב ליד ספר כדי להוסיף אותו לרשימת המועדפים.</p>
      </div>
    );
  }

  return (
    <div className="book-list">
      {books.map((b) => <BookCard key={b.id} book={b} from="favorites" />)}
    </div>
  );
}
