import React, { useEffect, useRef, useState } from 'react';
import {
  useStore, setQuery, setLayout, setSort, importFolders, toggleSidebar, setView,
  clearSelection, openSelection, deleteSelection, selectAll, bookById,
  addSelectionToCollection, createCollection, goBack,
} from '../lib/store.js';
import {
  IconMenu, IconSearch, IconMore, IconBack, IconCheck, IconBook, IconCollection,
  IconTrash, IconClose, IconPlus,
} from '../lib/icons.jsx';
import { VIEW_MODES } from './BookList.jsx';

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

const SORT_OPTIONS = [
  { key: 'title', label: 'שם הספר' },
  { key: 'author', label: 'מחבר' },
  { key: 'added', label: 'תאריך הוספה' },
  { key: 'size', label: 'גודל קובץ' },
  { key: 'progress', label: 'התקדמות קריאה' },
];

export default function TopBar() {
  const query = useStore((s) => s.query);
  const view = useStore((s) => s.view);
  const layout = useStore((s) => s.layout);
  const sort = useStore((s) => s.sort);
  const selection = useStore((s) => s.selection);
  const books = useStore((s) => s.books);
  const collections = useStore((s) => s.collections);
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  useEffect(() => {
    if (!query) setSearching(false);
  }, [query]);

  const title = TITLES[view] || 'SHOSO Books';
  // Detail screens (a book, an author, a format, a shelf) open with a back
  // arrow where the drawer button normally sits – the way ReadEra does it.
  const isDetail = ['book', 'author', 'format', 'collection'].includes(view);
  const canSearch = ['home', 'books', 'library', 'favorites', 'toread', 'haveread', 'authors', 'formats', 'collections', 'trash'].includes(view);
  const selecting = selection.length > 0;
  const selectedTitles = selection.map((id) => bookById(id)?.title).filter(Boolean);

  /* ReadEra's contextual bar: replaces the normal app bar while books are
     selected – close, count, then read / shelf / delete / overflow. */
  if (selecting) {
    return (
      <header className="topbar selection-bar">
        <button className="icon-btn" title="בטל בחירה (Esc)" onClick={clearSelection}>
          <IconClose size={21} />
        </button>
        <h1 className="topbar-title">
          {selection.length === 1 ? selectedTitles[0] || 'ספר נבחר' : `${selection.length} נבחרו`}
        </h1>
        <div className="topbar-actions">
          <button className="icon-btn" title="פתח לקריאה" onClick={openSelection}>
            <IconBook size={21} />
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              title="הוסף למדף"
              onClick={() => setShelfOpen((v) => !v)}
            >
              <IconCollection size={21} />
            </button>
            {shelfOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShelfOpen(false)} />
                <div className="topbar-menu-pop">
                  <span className="pop-label">הוסף למדף</span>
                  {collections.length === 0 && <button disabled>אין מדפים עדיין</button>}
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { addSelectionToCollection(c.id); setShelfOpen(false); }}
                    >
                      {c.name}
                      <span className="pop-count">{c.bookIds.length}</span>
                    </button>
                  ))}
                  <span className="pop-sep" />
                  <button
                    onClick={() => {
                      const id = createCollection('מדף חדש');
                      addSelectionToCollection(id);
                      setShelfOpen(false);
                    }}
                  >
                    <IconPlus size={15} /> מדף חדש
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="icon-btn" title="העבר לאשפה" onClick={deleteSelection}>
            <IconTrash size={21} />
          </button>
          <button
            className="icon-btn"
            title="עוד"
            onClick={() => (selection.length === books.length ? clearSelection() : selectAll(books.map((b) => b.id)))}
          >
            <IconMore size={20} />
          </button>
        </div>
      </header>
    );
  }

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
            {isDetail ? (
              <button className="icon-btn" onClick={goBack} title="חזרה">
                <IconBack size={22} />
              </button>
            ) : (
              <button className="icon-btn" onClick={toggleSidebar} title="תפריט">
                <IconMenu size={22} />
              </button>
            )}
          </div>
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-actions">
            {canSearch && (
              <button className="icon-btn" title="חיפוש" onClick={() => setSearching(true)}>
                <IconSearch size={21} />
              </button>
            )}
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
                    <span className="pop-label">מיון לפי</span>
                    {SORT_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        className={sort.key === o.key ? 'checked' : ''}
                        onClick={() => { setSort({ ...sort, key: o.key }); setMenuOpen(false); }}
                      >
                        {o.label}
                        {sort.key === o.key ? ' ✓' : ''}
                      </button>
                    ))}
                    <span className="pop-sep" />
                    <button
                      onClick={() => { setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' }); setMenuOpen(false); }}
                    >
                      {sort.dir === 'asc' ? 'סדר יורד' : 'סדר עולה'}
                    </button>
                    <span className="pop-sep" />
                    <span className="pop-label">תצוגת ספרייה</span>
                    {VIEW_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        className={layout === mode.id ? 'checked' : ''}
                        title={mode.hint}
                        onClick={() => { setLayout(mode.id); setMenuOpen(false); }}
                      >
                        {mode.label}
                        {layout === mode.id && <IconCheck size={15} />}
                      </button>
                    ))}
                    <span className="pop-sep" />
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
