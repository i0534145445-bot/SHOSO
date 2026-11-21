import React from 'react';
import { useStore, setQuery, setLayout, importFolders } from '../lib/store.js';
import { IconSearch, IconPlus, IconGrid, IconList } from '../lib/icons.jsx';

export default function TopBar() {
  const query = useStore((s) => s.query);
  const view = useStore((s) => s.view);
  const layout = useStore((s) => s.layout);
  const bookCount = useStore((s) => s.books.length);

  const titles = {
    home: 'בית',
    library: 'ספרייה',
    authors: 'מחברים',
    author: 'מחבר',
    formats: 'פורמטים',
    format: 'פורמט',
    favorites: 'מועדפים',
    history: 'היסטוריה',
    collections: 'מדפים',
    collection: 'מדף',
    folders: 'תיקיות',
    settings: 'הגדרות',
    book: 'פרטי ספר',
  };

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{titles[view] || 'SHOSO Books'}</h1>
        <span className="topbar-sub">{bookCount} ספרים בספרייה</span>
      </div>
      <div className="topbar-search">
        <IconSearch size={17} />
        <input
          id="global-search"
          type="search"
          placeholder="חיפוש ספר, מחבר או פורמט…  ( / )"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
        />
        {query && (
          <button className="icon-btn" onClick={() => setQuery('')} title="נקה חיפוש">
            ✕
          </button>
        )}
      </div>
      <div className="topbar-actions">
        {(view === 'library' || view === 'favorites' || view === 'home') && (
          <div className="seg">
            <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')} title="תצוגת רשת">
              <IconGrid size={16} />
            </button>
            <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')} title="תצוגת רשימה">
              <IconList size={16} />
            </button>
          </div>
        )}
        <button className="btn primary" onClick={importFolders}>
          <IconPlus size={16} /> ייבוא
        </button>
      </div>
    </header>
  );
}
