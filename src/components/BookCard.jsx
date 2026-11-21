import React from 'react';
import { useStore, openBook, toggleFavorite, setView } from '../lib/store.js';
import { formatRelative, formatSize } from '../lib/format.js';
import { IconHeart, IconBook, IconInfo } from '../lib/icons.jsx';
import Cover from './Cover.jsx';

export default function BookCard({ book }) {
  const favorites = useStore((s) => s.favorites);
  const progress = useStore((s) => s.progress[book.id]);
  const isFav = favorites.includes(book.id);
  const percent = progress?.percent || 0;

  return (
    <article className="book-card" onDoubleClick={() => openBook(book.id)}>
      <div className="book-cover-wrap" onClick={() => openBook(book.id)} title="פתח לקריאה">
        <Cover book={book} size="md" />
        {percent > 0 && percent < 100 && (
          <div className="progress-bar">
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
        {percent >= 100 && <span className="finished-badge">✓ נקרא</span>}
        <button
          className={`fav-btn ${isFav ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleFavorite(book.id); }}
          title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
        >
          <IconHeart size={16} filled={isFav} />
        </button>
      </div>
      <div className="book-meta">
        <h3 className="book-title" onClick={() => openBook(book.id)} title={book.title}>{book.title}</h3>
        <p className="book-author">{book.author}</p>
        <div className="book-tags">
          <span className="tag">{book.format}</span>
          {book.pageCount > 0 && <span className="tag">{book.pageCount} עמודים</span>}
          {percent > 0 && <span className="tag accent">{Math.round(percent)}%</span>}
        </div>
        <div className="book-actions">
          <button className="btn small primary" onClick={() => openBook(book.id)}>
            <IconBook size={14} /> {percent > 0 && percent < 100 ? 'המשך' : 'קרא'}
          </button>
          <button className="btn small ghost" onClick={() => setView('book', book.id)} title="פרטים">
            <IconInfo size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function BookRow({ book }) {
  const favorites = useStore((s) => s.favorites);
  const progress = useStore((s) => s.progress[book.id]);
  const isFav = favorites.includes(book.id);
  const percent = progress?.percent || 0;

  return (
    <article className="book-row" onDoubleClick={() => openBook(book.id)}>
      <div className="row-cover" onClick={() => openBook(book.id)}>
        <Cover book={book} size="sm" />
      </div>
      <div className="row-main" onClick={() => openBook(book.id)}>
        <h3>{book.title}</h3>
        <p>{book.author} · {book.format} · {formatSize(book.size)}</p>
      </div>
      <div className="row-progress">
        {percent > 0 ? <span>{Math.round(percent)}%</span> : <span className="dim">לא התחיל</span>}
        <div className="mini-bar"><span style={{ width: `${percent}%` }} /></div>
      </div>
      <span className="row-date">{formatRelative(progress?.updatedAt || book.addedAt)}</span>
      <button className={`icon-btn ${isFav ? 'active' : ''}`} onClick={() => toggleFavorite(book.id)} title="מועדף">
        <IconHeart size={17} filled={isFav} />
      </button>
      <button className="btn small primary" onClick={() => openBook(book.id)}>
        <IconBook size={14} /> {percent > 0 && percent < 100 ? 'המשך' : 'קרא'}
      </button>
    </article>
  );
}
