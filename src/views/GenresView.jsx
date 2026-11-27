import React, { useMemo } from 'react';
import { useStore, setView, genresOfLibrary } from '../lib/store.js';
import { IconFormat } from '../lib/icons.jsx';

/**
 * "ז'אנרים" – the shelf of styles and genres, built from the books' own
 * metadata (dc:subject in EPUB, <genre> in FB2) plus anything the reader
 * tagged by hand. Same card shape as Authors/Formats, so the library reads as
 * one product.
 */
export default function GenresView() {
  const books = useStore((s) => s.books);
  const customGenres = useStore((s) => s.customGenres);
  const query = useStore((s) => s.query);

  const genres = useMemo(() => {
    const list = genresOfLibrary(books);
    const needle = String(query || '').trim().toLowerCase();
    return needle ? list.filter((g) => g.genre.toLowerCase().includes(needle)) : list;
  }, [books, customGenres, query]);

  if (!genres.length) {
    return (
      <div className="empty-state small">
        <IconFormat size={40} />
        <p>
          {query
            ? 'לא נמצא ז׳אנר תואם.'
            : 'עוד אין ז׳אנרים. הם מגיעים מהמטא-דאטה של הספר (dc:subject ב-EPUB, genre ב-FB2), ואפשר להוסיף ידנית במסך הפרטים של כל ספר.'}
        </p>
      </div>
    );
  }

  return (
    <div className="authors-grid">
      {genres.map(({ genre, count }) => (
        <button key={genre} className="author-card" onClick={() => setView('genre', genre)}>
          <span className="author-avatar genre-avatar">{genre.slice(0, 2)}</span>
          <div>
            <strong>{genre}</strong>
            <span>{count} ספרים</span>
          </div>
        </button>
      ))}
    </div>
  );
}
