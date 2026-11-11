import React, { useEffect, useRef } from 'react';
import { useStore, setQuery, setView } from '../lib/store.js';
import { IconSearch, IconClose, IconKeyboard, IconSettings } from '../lib/icons.jsx';

const TITLES = {
  home: 'בית',
  songs: 'שירים',
  albums: 'אלבומים',
  album: 'אלבום',
  artists: 'אמנים',
  artist: 'אמן',
  playlists: 'פלייליסטים',
  playlist: 'פלייליסט',
  favorites: 'מועדפים',
  history: 'היסטוריית האזנה',
  folders: 'תיקיות',
  genre: 'ז׳אנרים',
  queue: 'תור נגינה',
  settings: 'הגדרות',
};

export default function TopBar({ onShowShortcuts }) {
  const query = useStore((s) => s.query);
  const view = useStore((s) => s.view);
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="topbar-title">
        <span className="eyebrow">SHOSO Music</span>
        <h1>{TITLES[view] || 'ספרייה'}</h1>
      </div>

      <div className={`search ${query ? 'has-value' : ''}`}>
        <IconSearch size={18} />
        <input
          ref={ref}
          id="global-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value && !['songs', 'home', 'albums', 'artists'].includes(view)) setView('songs');
          }}
          placeholder="חיפוש שירים, אמנים, אלבומים…  ( / )"
          aria-label="חיפוש"
        />
        {query && (
          <button className="icon-btn tiny" onClick={() => setQuery('')} title="נקה חיפוש">
            <IconClose size={15} />
          </button>
        )}
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" onClick={onShowShortcuts} title="מקשי קיצור (F1)">
          <IconKeyboard />
        </button>
        <button className="icon-btn" onClick={() => setView('settings')} title="הגדרות">
          <IconSettings />
        </button>
      </div>
    </header>
  );
}
