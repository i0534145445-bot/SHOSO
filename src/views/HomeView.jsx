import React from 'react';
import {
  useStore, continueReading, totalReadingTime, finishedCount, openBook,
  importFolders, setView,
} from '../lib/store.js';
import { formatReadingTime, formatRelative } from '../lib/format.js';
import { IconBook, IconClock, IconCheck, IconPlus, IconSparkle } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';
import Cover from '../components/Cover.jsx';

export default function HomeView() {
  const books = useStore((s) => s.books);
  const recent = useStore((s) => s.recent);
  const progress = useStore((s) => s.progress);
  const continuing = continueReading();
  const totalTime = totalReadingTime();
  const finished = finishedCount();

  const recentBooks = recent
    .map((id) => books.find((b) => b.id === id))
    .filter(Boolean)
    .slice(0, 8);

  const latest = [...books].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 8);

  if (!books.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><IconBook size={56} /></div>
        <h2>ברוך הבא ל-SHOSO Books</h2>
        <p>קורא ספרים שולחני כמו Readera – EPUB, PDF, TXT, FB2, HTML ו-Markdown.<br />הוסף תיקיות ספרים כדי להתחיל לקרוא.</p>
        <div className="empty-actions">
          <button className="btn primary large" onClick={importFolders}>
            <IconPlus size={18} /> הוסף תיקיות ספרים
          </button>
          <button className="btn ghost large" onClick={() => setView('library')}>
            עבור לספרייה
          </button>
        </div>
        <p className="dim small">טיפ: ניתן גם לגרור קבצי ספרים ישירות לחלון, או לנסות את ספרי הדמו מההגדרות.</p>
      </div>
    );
  }

  return (
    <div className="home-view">
      <section className="stats-row">
        <div className="stat-card">
          <IconBook size={22} />
          <div><strong>{books.length}</strong><span>ספרים בספרייה</span></div>
        </div>
        <div className="stat-card">
          <IconClock size={22} />
          <div><strong>{formatReadingTime(totalTime)}</strong><span>זמן קריאה כולל</span></div>
        </div>
        <div className="stat-card">
          <IconCheck size={22} />
          <div><strong>{finished}</strong><span>ספרים שהסתיימו</span></div>
        </div>
        <div className="stat-card">
          <IconSparkle size={22} />
          <div><strong>{continuing.length}</strong><span>ספרים בהמשך קריאה</span></div>
        </div>
      </section>

      {continuing.length > 0 && (
        <section>
          <div className="section-head">
            <h2>המשך קריאה</h2>
            <button className="btn ghost small" onClick={() => setView('history')}>כל ההיסטוריה</button>
          </div>
          <div className="continue-grid">
            {continuing.map(({ book, progress: p }) => (
              <button key={book.id} className="continue-card" onClick={() => openBook(book.id)}>
                <Cover book={book} size="sm" />
                <div className="continue-info">
                  <strong>{book.title}</strong>
                  <span>{book.author}</span>
                  <div className="mini-bar"><span style={{ width: `${p.percent || 0}%` }} /></div>
                  <span className="dim">{Math.round(p.percent || 0)}% · {formatRelative(p.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {recentBooks.length > 0 && (
        <section>
          <div className="section-head"><h2>נקראו לאחרונה</h2></div>
          <div className="book-grid">
            {recentBooks.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section>
          <div className="section-head">
            <h2>נוספו לאחרונה</h2>
            <button className="btn ghost small" onClick={() => setView('library')}>כל הספרייה</button>
          </div>
          <div className="book-grid">
            {latest.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}
