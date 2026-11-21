import React from 'react';
import { useStore, openBook } from '../lib/store.js';
import { formatRelative, formatReadingTime } from '../lib/format.js';
import { IconHistory } from '../lib/icons.jsx';
import Cover from '../components/Cover.jsx';

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
      <div className="empty-state small">
        <IconHistory size={40} />
        <p>עדיין לא קראת ספרים.<br />פתח ספר כדי להתחיל – ההתקדמות תישמר אוטומטית.</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {items.map(({ book, progress: p, time }) => (
        <button key={book.id} className="history-item" onClick={() => openBook(book.id)}>
          <Cover book={book} size="sm" />
          <div className="history-info">
            <strong>{book.title}</strong>
            <span>{book.author} · {book.format}</span>
            <div className="mini-bar"><span style={{ width: `${p?.percent || 0}%` }} /></div>
          </div>
          <div className="history-meta">
            <span>{Math.round(p?.percent || 0)}%</span>
            <span className="dim">{formatRelative(p?.updatedAt)}</span>
            {time > 0 && <span className="dim">{formatReadingTime(time)}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
