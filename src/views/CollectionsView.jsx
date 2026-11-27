import React, { useState } from 'react';
import { useStore, createCollection, setView, collectionsFromGenres, genresOfLibrary } from '../lib/store.js';
import { IconCollection, IconPlus } from '../lib/icons.jsx';

export default function CollectionsView() {
  const collections = useStore((s) => s.collections);
  const books = useStore((s) => s.books);
  const [name, setName] = useState('');
  const genreCount = genresOfLibrary(books).length;

  const create = () => {
    if (!name.trim()) return;
    createCollection(name);
    setName('');
  };

  return (
    <div>
      <div className="create-row">
        <input
          placeholder="שם המדף החדש…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn primary" onClick={create} disabled={!name.trim()}>
          <IconPlus size={16} /> צור מדף
        </button>
        <button
          className="btn ghost"
          onClick={() => collectionsFromGenres()}
          disabled={!genreCount}
          title={genreCount ? `מדף לכל ז׳אנר (${genreCount})` : 'אין ז׳אנרים בספרייה עדיין'}
        >
          <IconCollection size={16} /> מדפים לפי ז׳אנר ({genreCount})
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="empty-state small">
          <IconCollection size={40} />
          <p>אין מדפים עדיין.<br />מדף הוא אוסף ספרים אישי – כמו "לקרוא בחופש" או "ספרי לימוד".</p>
        </div>
      ) : (
        <div className="authors-grid">
          {collections.map((c) => {
            const first = books.find((b) => b.id === c.bookIds[0]);
            return (
              <button key={c.id} className="author-card" onClick={() => setView('collection', c.id)}>
                <span className="author-avatar">{first ? first.title.slice(0, 1) : '📚'}</span>
                <div>
                  <strong>{c.name}</strong>
                  <span>{c.bookIds.length} ספרים</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
