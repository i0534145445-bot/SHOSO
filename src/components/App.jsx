import React, { useEffect, useState } from 'react';
import {
  useStore, getState, setView, setQuery, importFolders,
} from '../lib/store.js';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import Reader from './Reader.jsx';
import Toasts from './Toasts.jsx';
import HomeView from '../views/HomeView.jsx';
import LibraryView from '../views/LibraryView.jsx';
import AuthorsView from '../views/AuthorsView.jsx';
import AuthorDetail from '../views/AuthorDetail.jsx';
import FormatsView from '../views/FormatsView.jsx';
import FormatDetail from '../views/FormatDetail.jsx';
import FavoritesView from '../views/FavoritesView.jsx';
import HistoryView from '../views/HistoryView.jsx';
import CollectionsView from '../views/CollectionsView.jsx';
import CollectionDetail from '../views/CollectionDetail.jsx';
import FoldersView from '../views/FoldersView.jsx';
import BookDetail from '../views/BookDetail.jsx';
import SettingsView from '../views/SettingsView.jsx';
import ToReadView from '../views/ToReadView.jsx';
import HaveReadView from '../views/HaveReadView.jsx';
import TrashView from '../views/TrashView.jsx';
import DropOverlay from './DropOverlay.jsx';
import ShortcutsDialog from './ShortcutsDialog.jsx';
import { handleDrop } from '../lib/store.js';

const VIEWS = {
  home: HomeView,
  books: LibraryView,
  library: LibraryView,
  toread: ToReadView,
  haveread: HaveReadView,
  trash: TrashView,
  authors: AuthorsView,
  author: AuthorDetail,
  formats: FormatsView,
  format: FormatDetail,
  favorites: FavoritesView,
  history: HistoryView,
  collections: CollectionsView,
  collection: CollectionDetail,
  folders: FoldersView,
  book: BookDetail,
  settings: SettingsView,
};

const isTyping = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export default function App() {
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);
  const scanStatus = useStore((s) => s.scanStatus);
  const [dragging, setDragging] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);

  const isReader = view === 'reader';
  const View = VIEWS[view] || HomeView;

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
      if (isReader) return; // Reader handles its own keys
      switch (event.code) {
        case 'Slash':
          event.preventDefault();
          document.getElementById('global-search')?.focus();
          break;
        case 'KeyO':
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
  }, [isReader]);

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

  if (isReader) {
    return (
      <>
        <Reader />
        <Toasts />
        {dragging && <DropOverlay />}
      </>
    );
  }

  return (
    <div className="app">
      <TopBar />
      <main className="main">
        <div className="view-scroll" key={view}>
          <View />
        </div>
      </main>
      <Sidebar />
      {scanStatus?.phase === 'scanning' && (
        <div className="scan-bar">
          <div className="spinner small" />
          <span>
            סורק ספרים… {scanStatus.done}/{scanStatus.total}
            {scanStatus.file ? ` · ${scanStatus.file}` : ''}
          </span>
          {scanStatus.total > 0 && (
            <div className="scan-progress">
              <span style={{ width: `${Math.round((scanStatus.done / scanStatus.total) * 100)}%` }} />
            </div>
          )}
        </div>
      )}
      <Toasts />
      {dragging && <DropOverlay />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
