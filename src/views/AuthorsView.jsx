import React from 'react';
import { useStore, authorsList, setView } from '../lib/store.js';
import { initials } from '../lib/format.js';
import { IconAuthor } from '../lib/icons.jsx';

export default function AuthorsView() {
  const query = useStore((s) => s.query);
  const authors = authorsList().filter((a) => !query || a.author.toLowerCase().includes(query.toLowerCase()));

  if (!authors.length) {
    return (
      <div className="empty-state small">
        <IconAuthor size={40} />
        <p>אין מחברים בספרייה</p>
      </div>
    );
  }

  return (
    <div className="authors-grid">
      {authors.map(({ author, count }) => (
        <button key={author} className="author-card" onClick={() => setView('author', author)}>
          <span className="author-avatar">{initials(author)}</span>
          <div>
            <strong>{author}</strong>
            <span>{count} ספרים</span>
          </div>
        </button>
      ))}
    </div>
  );
}
