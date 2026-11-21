import React, { useEffect, useRef, useState } from 'react';
import {
  useStore, setQuery, setLayout, importFolders, toggleSidebar, setView,
} from '../lib/store.js';
import {
  IconMenu, IconSearch, IconMore, IconGrid, IconList, IconBack,
} from '../lib/icons.jsx';

/**
 * Readera's app bar: one solid teal strip – menu, left-aligned screen title,
 * then search / overflow actions. Tapping the magnifier swaps the title for an
 * inline search field instead of opening a dialog.
 */
const TITLES = {
  home: 'קורא עכשיו',
  books: 'ספרים ומסמכים',
  library: 'ספרים ומסמכים',
  favorites: 'מועדפים',
  toread: 'לקריאה',
  haveread: 'נקראו',
  authors: 'מחברים',
  author: 'מחבר',
  formats: 'פורמטים',
  format: 'פורמט',
  collections: 'מדפים',
  collection: 'מדף',
  folders: 'תיקיות',
  downloads: 'הורדות',
  trash: 'אשפה',
  history: 'היסטוריה',
  settings: 'הגדרות',
  book: 'פרטי ספר',
};

export default function TopBar() {
  const query = useStore((s) => s.query);
  const view = useStore((s) => s.view);
  const layout = useStore((s) => s.layout);
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  useEffect(() => {
    if (!query) setSearching(false);
  }, [query]);

  const title = TITLES[view] || 'SHOSO Books';
  const canSearch = ['home', 'books', 'library', 'favorites', 'toread', 'haveread', 'authors', 'formats', 'collections', 'trash'].includes(view);

  return (
    <header className="topbar">
      {searching ? (
        <>
          <button className="icon-btn" title="סגור חיפוש" onClick={() => { setSearching(false); setQuery(''); }}>
            <IconBack size={22} />
          </button>
          <div className="topbar-search">
            <IconSearch size={18} />
            <input
              id="global-search"
              ref={inputRef}
              type="search"
              placeholder="חיפוש בספרייה"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSearching(false); setQuery(''); }
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="topbar-menu">
            <button className="icon-btn" onClick={toggleSidebar} title="תפריט">
              <IconMenu size={22} />
            </button>
          </div>
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-actions">
            {canSearch && (
              <button className="icon-btn" title="חיפוש" onClick={() => setSearching(true)}>
                <IconSearch size={21} />
              </button>
            )}
            <button
              className="icon-btn"
              title={layout === 'list' ? 'תצוגת כריכות' : 'תצוגת רשימה'}
              onClick={() => setLayout(layout === 'list' ? 'grid' : 'list')}
            >
              {layout === 'list' ? <IconGrid size={20} /> : <IconList size={20} />}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="icon-btn"
                title="עוד"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <IconMore size={20} />
              </button>
              {menuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="topbar-menu-pop">
                    <button onClick={() => { setMenuOpen(false); importFolders(); }}>הוסף תיקיות…</button>
                    <button onClick={() => { setMenuOpen(false); setView('settings'); }}>הגדרות</button>
                    <button onClick={() => { setMenuOpen(false); setView('trash'); }}>אשפה</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
