import React, { useEffect, useState } from 'react';
import {
  useStore, bookById, openBook, toggleFavorite, toggleToRead, toggleHaveRead,
  removeBook, setView, goBack, setState,
} from '../lib/store.js';
import { formatSize, formatDate, formatRelative } from '../lib/format.js';
import {
  IconStar, IconClock, IconDoubleCheck, IconRead, IconBookmark, IconBack,
  IconTrash, IconCollection, IconPlus,
} from '../lib/icons.jsx';
import Cover from '../components/Cover.jsx';
import { cachedDescription, describeBook, readingMinutes } from '../lib/description.js';

/**
 * ReadEra's "About document" screen – the step between the library and the
 * reader. ReadEra shows the cover, the annotation (the book's own description),
 * the reading state and the file's facts here, and only the explicit "Read"
 * action opens the book. Every control on this screen does something: there are
 * no decorative icons.
 */

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div className="bd-fact">
      <span className="bd-fact-label">{label}</span>
      <span className="bd-fact-value">{value}</span>
    </div>
  );
}

export default function BookDetail() {
  const bookId = useStore((s) => s.detailBookId);
  const book = bookById(bookId);
  const favorites = useStore((s) => s.favorites);
  const toRead = useStore((s) => s.toRead);
  const collections = useStore((s) => s.collections);
  const progress = useStore((s) => s.progress[bookId]);
  const bookmarks = useStore((s) => s.bookmarks[bookId] || []);
  const stats = useStore((s) => s.readingStats[bookId] || 0);
  const [info, setInfo] = useState(() => cachedDescription(bookId) || null);
  const [shelfOpen, setShelfOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setInfo(cachedDescription(bookId) || null);
    if (!book || cachedDescription(bookId)) return () => { alive = false; };
    describeBook(book).then((found) => { if (alive) setInfo(found); });
    return () => { alive = false; };
  }, [book, bookId]);

  if (!book) {
    return (
      <div className="empty-state small">
        <p>הספר לא נמצא</p>
        <button className="btn primary" onClick={goBack}>חזרה לספרייה</button>
      </div>
    );
  }

  const isFav = favorites.includes(book.id);
  const inToRead = toRead.includes(book.id);
  const percent = Math.round(progress?.percent || 0);
  const isRead = Boolean(progress?.finished) || percent >= 100;
  const started = percent > 0 && !isRead;
  const minutes = readingMinutes(book.wordCount);
  const open = () => openBook(book.id);

  const addToShelf = (collectionId) => {
    setState({
      collections: collections.map((c) => (
        c.id === collectionId ? { ...c, bookIds: [...new Set([...c.bookIds, book.id])] } : c
      )),
    });
    setShelfOpen(false);
  };

  return (
    <div className="book-detail">
      <div className="bd-sheet">
        <div className="bd-cover" onClick={open} title="פתח לקריאה">
          <Cover book={book} size="lg" />
        </div>

        <div className="bd-info">
          <h1 className="bd-title">{book.title}</h1>
          <p className="bd-author">{book.author || 'מחבר לא ידוע'}</p>

          <div className="bd-chips">
            <span className="bd-chip">{book.format}</span>
            {book.size ? <span className="bd-chip">{formatSize(book.size)}</span> : null}
            {book.chapters > 0 ? <span className="bd-chip">{book.chapters} פרקים</span> : null}
            {book.pageCount > 0 ? <span className="bd-chip">{book.pageCount} עמודים</span> : null}
            {minutes > 0 ? <span className="bd-chip">כ‑{minutes} דק׳ קריאה</span> : null}
          </div>

          {(started || isRead) && (
            <div className="bd-state">
              <div className="bd-state-line">
                <span>{isRead ? 'הקריאה הסתיימה' : `בתהליך קריאה · ${percent}%`}</span>
                {progress?.updatedAt && <span className="bd-state-when">{formatRelative(progress.updatedAt)}</span>}
              </div>
              <div className="bd-state-rail"><span style={{ width: `${percent}%` }} /></div>
            </div>
          )}

          <button className="btn primary large bd-read" onClick={open}>
            <IconRead size={18} />
            {started ? `המשך קריאה · ${percent}%` : isRead ? 'קרא שוב' : 'קרא את הספר'}
          </button>

          <div className="bd-tools">
            <button className={`bd-tool${isFav ? ' on' : ''}`} onClick={() => toggleFavorite(book.id)}>
              <IconStar size={18} filled={isFav} />
              {isFav ? 'במועדפים' : 'מועדפים'}
            </button>
            <button className={`bd-tool${inToRead ? ' on' : ''}`} onClick={() => toggleToRead(book.id)}>
              <IconClock size={18} />
              {inToRead ? 'ברשימת לקריאה' : 'לקריאה'}
            </button>
            <button className={`bd-tool${isRead ? ' on' : ''}`} onClick={() => toggleHaveRead(book.id)}>
              <IconDoubleCheck size={18} />
              {isRead ? 'נקרא' : 'סמן כנקרא'}
            </button>
            <div className="bd-tool-wrap">
              <button className="bd-tool" onClick={() => setShelfOpen((v) => !v)}>
                <IconCollection size={18} />
                הוסף למדף
              </button>
              {shelfOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShelfOpen(false)} />
                  <div className="topbar-menu-pop bd-shelf-pop">
                    <span className="pop-label">הוסף למדף</span>
                    {collections.length === 0 && <button disabled>אין מדפים עדיין</button>}
                    {collections.map((c) => (
                      <button key={c.id} onClick={() => addToShelf(c.id)}>
                        {c.name}
                        <span className="pop-count">{c.bookIds.length}</span>
                      </button>
                    ))}
                    <span className="pop-sep" />
                    <button onClick={() => setView('collections')}>
                      <IconPlus size={15} /> מדף חדש
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              className="bd-tool danger"
              onClick={() => { removeBook(book.id); goBack(); }}
            >
              <IconTrash size={18} />
              העבר לאשפה
            </button>
          </div>

          <section className="bd-section">
            <h2 className="bd-section-title">תיאור</h2>
            {info === null ? (
              <p className="bd-desc loading">טוען את תיאור הספר…</p>
            ) : info.description ? (
              <p className="bd-desc">{info.description}</p>
            ) : (
              <p className="bd-desc empty">לקובץ הזה אין תיאור מובנה. הוא נפתח לקריאה, והפרק הראשון זמין מיד.</p>
            )}
            {(info?.publisher || info?.year || info?.series) && (
              <div className="bd-publish">
                {info.series ? <span>{info.series}</span> : null}
                {info.publisher ? <span>{info.publisher}</span> : null}
                {info.year ? <span>{info.year}</span> : null}
              </div>
            )}
          </section>

          {bookmarks.length > 0 && (
            <section className="bd-section">
              <h2 className="bd-section-title">סימניות ({bookmarks.length})</h2>
              <div className="bd-bookmarks">
                {bookmarks.slice(0, 4).map((bm) => (
                  <button key={bm.id} className="bd-bookmark" onClick={open}>
                    <IconBookmark size={16} />
                    <span>{bm.label || `פרק ${(bm.chapter || 0) + 1}`}</span>
                    {bm.createdAt ? <em>{formatRelative(bm.createdAt)}</em> : null}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="bd-section">
            <h2 className="bd-section-title">מידע על הקובץ</h2>
            <div className="bd-facts">
              <Fact label="פורמט" value={book.format} />
              <Fact label="גודל" value={book.size ? formatSize(book.size) : ''} />
              <Fact label="שם הקובץ" value={book.fileName} />
              <Fact label="מיקום" value={book.path && !book.path.startsWith('blob:') ? book.path : ''} />
              <Fact label="נוסף לספרייה" value={formatDate(book.addedAt)} />
              {stats > 0 ? <Fact label="זמן קריאה" value={`${Math.round(stats / 60)} דקות`} /> : null}
            </div>
          </section>

          <button className="bd-back" onClick={goBack}>
            <IconBack size={17} />
            חזרה לרשימה
          </button>
        </div>
      </div>
    </div>
  );
}
