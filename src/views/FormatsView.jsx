import React from 'react';
import { useStore, formatsList, setView } from '../lib/store.js';
import { IconFormat } from '../lib/icons.jsx';

export default function FormatsView() {
  const formats = formatsList();

  if (!formats.length) {
    return (
      <div className="empty-state small">
        <IconFormat size={40} />
        <p>אין ספרים בספרייה</p>
      </div>
    );
  }

  return (
    <div className="authors-grid">
      {formats.map(({ format, count }) => (
        <button key={format} className="author-card" onClick={() => setView('format', format)}>
          <span className="author-avatar format">{format}</span>
          <div>
            <strong>{format}</strong>
            <span>{count} ספרים</span>
          </div>
        </button>
      ))}
    </div>
  );
}
