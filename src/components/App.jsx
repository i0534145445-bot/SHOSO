import React, { useEffect, useState } from 'react';
import {
  useStore, getState, togglePlay, nextTrack, prevTrack, seekBy, toggleMute, setRate,
  handleDrop, importFolders, setQuery, toggleLyrics,
} from '../lib/store.js';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import PlayerBar from './PlayerBar.jsx';
import LyricsPanel from './LyricsPanel.jsx';
import Toasts from './Toasts.jsx';
import SongsView from '../views/SongsView.jsx';
import AlbumsView from '../views/AlbumsView.jsx';
import ArtistsView from '../views/ArtistsView.jsx';
import AlbumDetail from '../views/AlbumDetail.jsx';
import ArtistDetail from '../views/ArtistDetail.jsx';
import PlaylistsView from '../views/PlaylistsView.jsx';
import PlaylistDetail from '../views/PlaylistDetail.jsx';
import FavoritesView from '../views/FavoritesView.jsx';
import SettingsView from '../views/SettingsView.jsx';
import QueuePanel from '../views/QueuePanel.jsx';
import HomeView from '../views/HomeView.jsx';
import HistoryView from '../views/HistoryView.jsx';
import FoldersView from '../views/FoldersView.jsx';
import GenreView from '../views/GenreView.jsx';
import DropOverlay from './DropOverlay.jsx';
import ShortcutsDialog from './ShortcutsDialog.jsx';

const VIEWS = {
  home: HomeView,
  songs: SongsView,
  albums: AlbumsView,
  album: AlbumDetail,
  artists: ArtistsView,
  artist: ArtistDetail,
  playlists: PlaylistsView,
  playlist: PlaylistDetail,
  favorites: FavoritesView,
  history: HistoryView,
  folders: FoldersView,
  genre: GenreView,
  queue: QueuePanel,
  settings: SettingsView,
};

const isTyping = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export default function App() {
  const view = useStore((s) => s.view);
  const showLyrics = useStore((s) => s.showLyrics);
  const theme = useStore((s) => s.theme);
  const [dragging, setDragging] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);

  const View = VIEWS[view] || SongsView;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKey = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (isTyping(event.target)) {
        if (event.key === 'Escape') event.target.blur();
        return;
      }
      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (mod) nextTrack();
          else seekBy(5);
          break;
        case 'ArrowLeft':
          if (mod) prevTrack();
          else seekBy(-5);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setRate(Math.min(2, getState().rate + 0.05));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setRate(Math.max(0.5, getState().rate - 0.05));
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyF':
          if (mod) {
            event.preventDefault();
            window.shoso?.toggleFullscreen?.();
          }
          break;
        case 'KeyL':
          togglePlay();
          break;
        case 'KeyY':
          toggleLyrics();
          break;
        case 'Slash':
          event.preventDefault();
          document.getElementById('global-search')?.focus();
          break;
        case 'KeyI':
          if (mod) {
            event.preventDefault();
            importFolders();
          }
          break;
        case 'Escape':
          if (getState().query) setQuery('');
          break;
        case 'F1':
          event.preventDefault();
          setShowShortcuts((v) => !v);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDragEnter = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      setDragDepth((d) => d + 1);
      setDragging(true);
    };
    const onDragLeave = () => {
      setDragDepth((d) => {
        const next = Math.max(0, d - 1);
        if (next === 0) setDragging(false);
        return next;
      });
    };
    const onDragOver = (e) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    };
    const onDrop = async (e) => {
      setDragDepth(0);
      setDragging(false);
      await handleDrop(e);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return (
    <div className={`app ${showLyrics ? 'with-lyrics' : ''}`}>
      <Sidebar />
      <main className="main">
        <TopBar onShowShortcuts={() => setShowShortcuts(true)} />
        <div className="view-scroll" key={view}>
          <View />
        </div>
      </main>
      {showLyrics && <LyricsPanel />}
      <PlayerBar />
      <Toasts />
      {dragging && <DropOverlay />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
