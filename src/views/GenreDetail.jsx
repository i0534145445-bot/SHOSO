import React, { useMemo } from 'react';
import { useStore, setView, booksInGenre } from '../lib/store.js';
import { IconBack } from '../lib/icons.jsx';
import BookList from '../components/BookList.jsx';

/** All the books of one genre, in whichever library view is selected. */
export default function GenreDetail() {
  const genre = useStore((s) => s.detailBookId);
  const books = useStore((s) => s.books);
  const customGenres = useStore((s) => s.customGenres);

  const list = useMemo(() => booksInGenre(genre, books), [genre, books, customGenres]);

  return (
    <div>
      <button className="btn ghost small" onClick={() => setView('genres')}>
        <IconBack size={15} /> חזרה לז׳אנרים
      </button>
      <div className="detail-head">
        <span className="author-avatar large genre-avatar">{(genre || '?').slice(0, 2)}</span>
        <div>
          <h2>{genre}</h2>
          <p className="dim">{list.length} ספרים בספרייה</p>
        </div>
      </div>
      {list.length ? (
        <BookList books={list} from="genre" />
      ) : (
        <p className="dim">אין ספרים בז׳אנר הזה.</p>
      )}
    </div>
  );
}
