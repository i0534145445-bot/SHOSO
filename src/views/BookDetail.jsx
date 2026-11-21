import React from 'react';
import { useStore, bookById, openBook, toggleFavorite, removeBook, setView, toast } from '../lib/store.js';
import { formatSize, formatDate, formatRelative } from '../lib/format.js';
import { IconBack, IconBook, IconHeart, IconTrash, IconExternal, IconClock } from '../lib/icons.jsx';
import { revealInExplorer } from '../lib/platform.js';
import Cover from '../components/Cover.jsx';

export default function BookDetail() {
  const bookId = useStore((s) => s.detailBookId);
  const book = bookById(bookId);
  const favorites = useStore((s) => s.favorites);
  const progress = useStore((s) => s.progress[bookId]);
  const stats = useStore((s) => s.readingStats[bookId] || 0);

  if (!book) {
    return (
      <div className="empty-state small">
        <p>הספר לא נמצא</p>
        <button className="btn primary" onClick={() => setView('library')}>חזרה לספרייה</button>
      </div>
    );
  }

  const isFav = favorites.includes(book.id);
  const percent = progress?.percent || 0;

  return (
    <div className="book-detail">
      <button className="btn ghost small" onClick={() => setView('library')}>
        <IconBack size={15} /> חזרה לספרייה
      </button>

      <div className="detail-hero">
        <Cover book={book} size="lg" />
        <div className="detail-info">
          <h2>{book.title}</h2>
          <p className="detail-author">{book.author}</p>
          <div className="detail-tags">
            <span className="tag">{book.format}</span>
            {book.language && <span className="tag">{book.language.toUpperCase()}</span>}
            {book.pageCount > 0 && <span className="tag">{book.pageCount} עמודים</span>}
            {book.chapters > 0 && <span className="tag">{book.chapters} פרקים</span>}
            {book.wordCount > 0 && <span className="tag">{book.wordCount.toLocaleString()} מילים</span>}
          </div>

          {percent > 0 && (
            <div className="detail-progress">
              <div className="mini-bar"><span style={{ width: `${percent}%` }} /></div>
              <span>{Math.round(percent)}% נקראו{progress?.updatedAt ? ` · עודכן ${formatRelative(progress.updatedAt)}` : ''}</span>
            </div>
          )}

          <div className="detail-actions">
            <button className="btn primary large" onClick={() => openBook(book.id)}>
              <IconBook size={17} /> {percent > 0 && percent < 100 ? 'המשך קריאה' : 'פתח לקריאה'}
            </button>
            <button className={`btn ${isFav ? 'primary' : 'ghost'}`} onClick={() => toggleFavorite(book.id)}>
              <IconHeart size={16} filled={isFav} /> {isFav ? 'במועדפים' : 'הוסף למועדפים'}
            </button>
            <button className="btn ghost" onClick={() => revealInExplorer(book.path)}>
              <IconExternal size={16} /> הצג בתיקייה
            </button>
            <button className="btn ghost danger" onClick={() => { removeBook(book.id); setView('library'); }}>
              <IconTrash size={16} /> הסר מהספרייה
            </button>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h3>פרטים</h3>
          <dl>
            <div><dt>שם קובץ</dt><dd>{book.fileName}</dd></div>
            <div><dt>נתיב</dt><dd className="mono">{book.path}</dd></div>
            <div><dt>גודל</dt><dd>{formatSize(book.size)}</dd></div>
            <div><dt>נוסף</dt><dd>{formatDate(book.addedAt)}</dd></div>
            <div><dt>עודכן</dt><dd>{formatDate(book.mtime)}</dd></div>
          </dl>
        </div>
        <div className="detail-card">
          <h3>התקדמות</h3>
          <dl>
            <div><dt>אחוז קריאה</dt><dd>{Math.round(percent)}%</dd></div>
            <div><dt>פרק נוכחי</dt><dd>{progress?.chapter !== undefined ? `פרק ${(progress.chapter || 0) + 1}` : '—'}</dd></div>
            <div><dt>עמוד נוכחי</dt><dd>{progress?.page ? `עמוד ${progress.page}` : '—'}</dd></div>
            <div><dt>זמן קריאה</dt><dd>{stats ? `${Math.round(stats / 60)} דק׳` : '—'}</dd></div>
            <div><dt>סטטוס</dt><dd>{percent >= 100 ? 'הסתיים ✓' : percent > 0 ? 'בתהליך' : 'לא התחיל'}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
