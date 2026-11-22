import React from 'react';
import {
  useStore, bookById, openBook, toggleFavorite, toggleToRead, toggleHaveRead,
  removeBook, setView,
} from '../lib/store.js';
import { formatSize, formatDate, formatRelative } from '../lib/format.js';
import {
  IconStar, IconClock, IconDoubleCheck, IconBook, IconBookmark, IconEdit,
  IconTrash, IconClose,
} from '../lib/icons.jsx';
import Cover from '../components/Cover.jsx';

/**
 * ReadEra's "book description" screen: a large centred cover, the title, a row
 * of flat action glyphs (favourite / to-read / have-read / open / bookmark /
 * edit / delete) and then label-over-value metadata pairs.
 */

function Meta({ label, value, gold = false, mono = false }) {
  if (!value) return null;
  return (
    <div className="bd-meta-row">
      <span className="bd-meta-label">{label}</span>
      <span className={`bd-meta-value${gold ? ' gold' : ''}${mono ? ' mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function BookDetail() {
  const bookId = useStore((s) => s.detailBookId);
  const book = bookById(bookId);
  const favorites = useStore((s) => s.favorites);
  const toRead = useStore((s) => s.toRead);
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
  const inToRead = toRead.includes(book.id);
  const percent = progress?.percent || 0;
  const isRead = Boolean(progress?.finished) || percent >= 100;
  const status = percent >= 100 || isRead
    ? 'הקריאה הסתיימה'
    : percent > 0
      ? `בתהליך קריאה · ${Math.round(percent)}%`
      : 'טרם החלה קריאה';

  const open = () => openBook(book.id);

  return (
    <div className="book-detail">
      <div className="bd-cover" onClick={open}>
        <Cover book={book} size="lg" />
      </div>

      <h1 className="bd-title">{book.title}</h1>
      {book.author && <p className="bd-author">{book.author}</p>}

      <div className="bd-actions">
        <button className={isFav ? 'on' : ''} onClick={() => toggleFavorite(book.id)} title="מועדפים">
          <IconStar size={23} filled={isFav} />
        </button>
        <button className={inToRead ? 'on' : ''} onClick={() => toggleToRead(book.id)} title="לקריאה">
          <IconClock size={23} />
        </button>
        <button className={`done ${isRead ? 'on' : 'gold'}`} onClick={() => toggleHaveRead(book.id)} title="נקרא">
          <IconDoubleCheck size={23} />
        </button>
        <button onClick={open} title="פתח לקריאה">
          <IconBook size={23} />
        </button>
        <button onClick={() => { open(); }} title="סימניות">
          <IconBookmark size={23} />
        </button>
        <button onClick={() => setView('library')} title="סגור">
          <IconClose size={23} />
        </button>
        <button className="danger" onClick={() => { removeBook(book.id); setView('library'); }} title="הסר מהספרייה">
          <IconTrash size={23} />
        </button>
      </div>

      <div className="bd-meta">
        <Meta label="קבצים ומסמכים" value={book.format} />
        <Meta label="סטטוס" value={status} gold={percent < 100} />
        <Meta label="גודל" value={formatSize(book.size)} />
        <Meta label="מיקום" value={book.path} mono />
        <Meta label="מזהה הקובץ" value={book.fileName} mono />
        <Meta label="נוסף לספרייה" value={`${formatDate(book.addedAt)}${progress?.updatedAt ? ` · ${formatRelative(progress.updatedAt)}` : ''}`} />
        {book.chapters > 0 && <Meta label="פרקים" value={`${book.chapters}`} />}
        {stats > 0 && <Meta label="זמן קריאה" value={`${Math.round(stats / 60)} דקות`} />}
      </div>

      <div className="bd-footer">
        <button className="btn primary large" onClick={open}>
          {percent > 0 && percent < 100 ? 'המשך קריאה' : 'פתח לקריאה'}
        </button>
        <button className="btn ghost" onClick={() => setView('library')}>
          <IconEdit size={16} /> חזרה לספרייה
        </button>
      </div>
    </div>
  );
}
