import React, { useState } from 'react';
import { useStore, setView, createPlaylist, importFolders, importFiles, openPlaylist } from '../lib/store.js';
import {
  IconHome, IconMusic, IconAlbum, IconArtist, IconPlaylist, IconHeart,
  IconFolder, IconClock, IconQueue, IconSettings, IconPlus, IconGenre,
} from '../lib/icons.jsx';
import Logo from './Logo.jsx';

function NavItem({ id, label, icon: Icon, badge }) {
  const active = useStore((s) => s.view === id);
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={() => setView(id)}
      title={label}
    >
      <Icon />
      <span className="nav-label">{label}</span>
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}

function PlaylistItem({ playlist, active }) {
  return (
    <button
      className={`nav-item playlist-item ${active ? 'active' : ''}`}
      onClick={() => openPlaylist(playlist.id)}
      title={playlist.name}
    >
      <IconPlaylist />
      <span className="nav-label">{playlist.name}</span>
      <span className="nav-badge subtle">{playlist.trackIds.length}</span>
    </button>
  );
}

export default function Sidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const playlistList = useStore((s) => s.playlists);
  const favoriteCount = useStore((s) => s.favorites.length);
  const trackCount = useStore((s) => s.tracks.length);
  const activePlaylist = useStore((s) => (s.view === 'playlist' ? window.__shosoSelectedPlaylist : null));
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const submit = () => {
    const value = name.trim();
    if (value) {
      const playlist = createPlaylist(value);
      openPlaylist(playlist.id);
    }
    setName('');
    setCreating(false);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <strong>SHOSO</strong>
          <span>Music for Windows</span>
        </div>
      </div>

      <nav className="nav">
        <NavItem id="home" label="בית" icon={IconHome} />
        <NavItem id="songs" label="שירים" icon={IconMusic} badge={trackCount || null} />
        <NavItem id="albums" label="אלבומים" icon={IconAlbum} />
        <NavItem id="artists" label="אמנים" icon={IconArtist} />
        <NavItem id="genre" label="ז׳אנרים" icon={IconGenre} />
        <NavItem id="folders" label="תיקיות" icon={IconFolder} />
        <NavItem id="favorites" label="מועדפים" icon={IconHeart} badge={favoriteCount || null} />
        <NavItem id="history" label="היסטוריה" icon={IconClock} />
        <NavItem id="queue" label="תור נגינה" icon={IconQueue} />
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <span>פלייליסטים</span>
          <button className="icon-btn tiny" title="פלייליסט חדש" onClick={() => setCreating(true)}>
            <IconPlus />
          </button>
        </div>

        {creating && (
          <div className="new-playlist">
            <input
              autoFocus
              value={name}
              placeholder="שם הפלייליסט"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') {
                  setCreating(false);
                  setName('');
                }
              }}
              onBlur={submit}
            />
          </div>
        )}

        <div className="playlist-list">
          {playlistList.length === 0 && !creating && <p className="sidebar-empty">עדיין אין פלייליסטים</p>}
          {playlistList.map((playlist) => (
            <PlaylistItem key={playlist.id} playlist={playlist} active={activePlaylist === playlist.id} />
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <NavItem id="settings" label="הגדרות" icon={IconSettings} />
        <div className="sidebar-actions">
          <button className="btn ghost small" onClick={() => importFolders()} title="הוסף תיקיית מוזיקה (Ctrl+I)">
            <IconPlus size={15} /> תיקייה
          </button>
          <button className="btn ghost small" onClick={() => importFiles()} title="הוסף קבצים בודדים">
            קבצים
          </button>
        </div>
      </div>
    </aside>
  );
}
