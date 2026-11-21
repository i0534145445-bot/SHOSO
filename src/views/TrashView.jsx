import React from 'react';
import { useStore, restoreBook, purgeBook } from '../lib/store.js';
import { formatSize } from '../lib/format.js';
import { IconTrash, IconRestore } from '../lib/icons.jsx';
import Cover from '../components/Cover.jsx';

/** Readera's "Trash" — removed books can be restored or deleted for good. */
export default function TrashView() {
  const trash = useStore((s) => s.trash);

  if (!trash.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><IconTrash size={52} /></div>
        <h2>האשפה ריקה</h2>
        <p>ספרים שתסיר מהספרייה יופיעו כאן וניתן יהיה לשחזר אותם.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <span className="dim small">{trash.length} ספרים באשפה</span>
        <button className="btn ghost small danger" onClick={() => purgeBook()}>רוקן אשפה</button>
      </div>
      <div className="book-list">
        {trash.map((book) => (
          <article key={book.id} className="book-row">
            <div className="row-cover"><Cover book={book} size="sm" /></div>
            <div className="row-main">
              <h3>{book.title}</h3>
              <p>{book.author || 'מחבר לא ידוע'}</p>
              <p className="row-format">{book.format}{book.size ? `, ${formatSize(book.size)}` : ''}</p>
              <div className="row-rail hidden" />
            </div>
            <div className="row-actions" style={{ justifyContent: 'flex-end', gap: 4 }}>
              <button className="icon-btn" title="שחזר" onClick={() => restoreBook(book.id)}>
                <IconRestore size={19} />
              </button>
              <button className="icon-btn" title="מחק לצמיתות" onClick={() => purgeBook(book.id)}>
                <IconTrash size={19} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
