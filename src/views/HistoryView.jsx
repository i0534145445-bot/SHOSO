import React from 'react';
import { useStore, openBookFrom } from '../lib/store.js';
import { formatRelative, formatReadingTime } from '../lib/format.js';
import { IconHistory } from '../lib/icons.jsx';
import Cover from '../components/Cover.jsx';

/** Reading history — Readera keeps this alongside "Reading Now". */
export default function HistoryView() {
  const recent = useStore((s) => s.recent);
  const progress = useStore((s) => s.progress);
  const stats = useStore((s) => s.readingStats);
  const books = useStore((s) => s.books);

  const items = recent
    .map((id) => ({ book: books.find((b) => b.id === id), progress: progress[id], time: stats[id] || 0 }))
    .filter((x) => x.book);

  if (!items.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><IconHistory size={52} /></div>
        <h2>אין היסטוריית קריאה</h2>
        <p>פתח ספר כדי להתחיל – ההתקדמות נשמרת אוטומטית.</p>
      </div>
    );
  }

  return (
    <div className="book-list">
      {items.map(({ book, progress: p, time }) => (
        <article key={book.id} className="book-row" onClick={() => openBookFrom(book.id, 'history')}>
          <div className="row-cover"><Cover book={book} size="sm" /></div>
          <div className="row-main">
            <h3>{book.title}</h3>
            <p>{book.author} · {book.format}</p>
            <p className="row-format">
              {formatRelative(p?.updatedAt)}
              {time > 0 ? ` · ${formatReadingTime(time)}` : ''}
            </p>
            <div className="row-rail">
              <span style={{ width: `${Math.round(p?.percent || 0)}%` }} />
            </div>
            <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
              <span className="dim small">{Math.round(p?.percent || 0)}%</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
