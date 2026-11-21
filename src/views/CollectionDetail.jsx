import React, { useState } from 'react';
import { useStore, setView, renameCollection, deleteCollection, toggleInCollection, toast } from '../lib/store.js';
import { IconBack, IconTrash, IconEdit, IconCheck } from '../lib/icons.jsx';
import BookCard from '../components/BookCard.jsx';

export default function CollectionDetail() {
  const collectionId = useStore((s) => s.detailBookId);
  const collection = useStore((s) => s.collections.find((c) => c.id === collectionId));
  const books = useStore((s) => s.books);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (!collection) {
    return (
      <div className="empty-state small">
        <p>המדף לא נמצא</p>
        <button className="btn primary" onClick={() => setView('collections')}>חזרה למדפים</button>
      </div>
    );
  }

  const inCollection = books.filter((b) => collection.bookIds.includes(b.id));
  const others = books.filter((b) => !collection.bookIds.includes(b.id));

  return (
    <div>
      <div className="detail-head">
        <button className="btn ghost small" onClick={() => setView('collections')}>
          <IconBack size={15} /> מדפים
        </button>
        {editing ? (
          <div className="create-row">
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <button className="btn primary small" onClick={() => { renameCollection(collection.id, name); setEditing(false); }}>
              <IconCheck size={14} /> שמור
            </button>
          </div>
        ) : (
          <>
            <h2>{collection.name}</h2>
            <span className="dim">{collection.bookIds.length} ספרים</span>
            <div className="head-actions">
              <button className="btn ghost small" onClick={() => { setName(collection.name); setEditing(true); }}>
                <IconEdit size={14} /> שנה שם
              </button>
              <button className="btn ghost small danger" onClick={() => { deleteCollection(collection.id); setView('collections'); toast('המדף נמחק', 'info'); }}>
                <IconTrash size={14} /> מחק מדף
              </button>
            </div>
          </>
        )}
      </div>

      {inCollection.length === 0 ? (
        <div className="empty-state small"><p>המדף ריק – הוסף ספרים מהרשימה למטה</p></div>
      ) : (
        <div className="book-grid">
          {inCollection.map((b) => (
            <div key={b.id} className="card-with-remove">
              <BookCard book={b} />
              <button className="btn small ghost danger" onClick={() => toggleInCollection(collection.id, b.id)}>
                הסר מהמדף
              </button>
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <section>
          <h3 className="section-title">הוסף למדף</h3>
          <div className="book-grid">
            {others.map((b) => (
              <div key={b.id} className="card-with-remove">
                <BookCard book={b} />
                <button className="btn small ghost" onClick={() => toggleInCollection(collection.id, b.id)}>
                  <IconCheck size={14} /> הוסף
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
