/**
 * Application store – a tiny observable state container (no external deps).
 *
 * Holds the book library, reading progress, bookmarks, collections and
 * reader settings, and persists everything (Electron: JSON in
 * %APPDATA%/SHOSO Books, browser: localStorage).
 */

import { useRef, useSyncExternalStore } from 'react';
import {
  initPlatform,
  appInfo,
  isDesktop,
  loadPersistedState,
  savePersistedState,
  loadPersistedLibrary,
  savePersistedLibrary,
  booksFromFiles,
  pickFolders,
  pickFiles,
  pathForFile,
} from './platform.js';
import { bookHaystack, matchesQuery, collate, normalize } from './format.js';

export const READER_THEMES = ['light', 'dark', 'sepia', 'night'];
export const FONT_FAMILIES = [
  { id: 'serif', label: 'סריף (ברירת מחדל)', value: "Georgia, 'Times New Roman', 'David', serif" },
  { id: 'sans', label: 'ללא סריף', value: "'Segoe UI', 'Rubik', 'Heebo', system-ui, sans-serif" },
  { id: 'hebrew', label: 'עברי קלאסי', value: "'David', 'Frank Ruehl', 'Times New Roman', serif" },
  { id: 'mono', label: 'מונוספייס', value: "'Consolas', 'Courier New', monospace" },
];

export const DEFAULT_READER = {
  theme: 'dark',
  fontSize: 18,
  lineHeight: 1.7,
  fontFamily: 'serif',
  margins: 48,
  justify: false,
  hyphenation: true,
  mode: 'scroll', // 'scroll' | 'paginated'
  maxWidth: 720,
};

const DEFAULT_STATE = {
  books: [],
  folders: [],
  collections: [],
  favorites: [],
  recent: [],
  progress: {}, // bookId -> { chapter, scroll, page, percent, updatedAt, finished, totalChapters, totalPages }
  bookmarks: {}, // bookId -> [{ id, chapter, scroll, page, label, createdAt }]
  readingStats: {}, // bookId -> seconds
  currentBookId: null,
  view: 'home',
  detailBookId: null,
  theme: 'dark',
  accent: 'violet',
  sidebarCollapsed: false,
  query: '',
  sort: { key: 'title', dir: 'asc' },
  layout: 'grid', // 'grid' | 'list'
  reader: { ...DEFAULT_READER },
  scanStatus: null,
  toasts: [],
};

let state = { ...DEFAULT_STATE };
const listeners = new Set();
let saveTimer = null;
let persistLibraryTimer = null;

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

function emit() {
  notify();
  scheduleSave();
}

export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  emit();
}

/* ------------------------------------------------------------------ */
/* Selector hook                                                       */
/* ------------------------------------------------------------------ */

const shallowEqual = (a, b) => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) if (!Object.is(a[key], b[key])) return false;
    return true;
  }
  return false;
};

export function useStore(selector = (s) => s) {
  const cache = useRef({ state: null, value: undefined });

  const getSnapshot = () => {
    const current = cache.current;
    if (current.state !== state) {
      const next = selector(state);
      current.value = shallowEqual(current.value, next) ? current.value : next;
      current.state = state;
    }
    return current.value;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const PERSIST_KEYS = [
  'folders', 'collections', 'favorites', 'recent', 'progress', 'bookmarks',
  'readingStats', 'view', 'theme', 'accent', 'sidebarCollapsed', 'sort',
  'layout', 'reader', 'currentBookId',
];

const serialize = () => {
  const out = {};
  for (const key of PERSIST_KEYS) out[key] = state[key];
  return out;
};

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => savePersistedState(serialize()), 400);
}

function scheduleLibrarySave() {
  clearTimeout(persistLibraryTimer);
  persistLibraryTimer = setTimeout(() => {
    if (isDesktop) savePersistedLibrary({ books: state.books, savedAt: Date.now() });
  }, 1500);
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

export async function bootstrap() {
  await initPlatform();
  const [savedState, savedLibrary] = await Promise.all([loadPersistedState(), loadPersistedLibrary()]);
  const patch = {};

  if (savedState && typeof savedState === 'object') {
    for (const key of PERSIST_KEYS) {
      if (savedState[key] !== undefined) patch[key] = savedState[key];
    }
  }
  if (savedLibrary && Array.isArray(savedLibrary.books) && savedLibrary.books.length) {
    patch.books = savedLibrary.books;
  }
  if (patch.books) {
    const ids = new Set(patch.books.map((b) => b.id));
    patch.favorites = (patch.favorites || []).filter((id) => ids.has(id));
    patch.recent = (patch.recent || []).filter((id) => ids.has(id));
    patch.collections = (patch.collections || []).map((c) => ({
      ...c,
      bookIds: (c.bookIds || []).filter((id) => ids.has(id)),
    }));
    if (patch.currentBookId && !ids.has(patch.currentBookId)) patch.currentBookId = null;
  }

  // Defensive sanitation
  const num = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  patch.reader = { ...DEFAULT_READER, ...(patch.reader || {}) };
  patch.reader.fontSize = num(patch.reader.fontSize, 18, 12, 32);
  patch.reader.lineHeight = num(patch.reader.lineHeight, 1.7, 1.2, 2.4);
  patch.reader.margins = num(patch.reader.margins, 48, 0, 120);
  patch.reader.maxWidth = num(patch.reader.maxWidth, 720, 480, 1100);
  if (!READER_THEMES.includes(patch.reader.theme)) patch.reader.theme = 'dark';
  if (!['scroll', 'paginated'].includes(patch.reader.mode)) patch.reader.mode = 'scroll';
  if (!patch.sort || typeof patch.sort !== 'object' || !patch.sort.key) {
    patch.sort = { key: 'title', dir: 'asc' };
  }
  for (const key of ['collections', 'favorites', 'recent', 'folders']) {
    if (!Array.isArray(patch[key])) patch[key] = [];
  }
  if (typeof patch.progress !== 'object' || patch.progress === null) patch.progress = {};
  if (typeof patch.bookmarks !== 'object' || patch.bookmarks === null) patch.bookmarks = {};
  if (typeof patch.readingStats !== 'object' || patch.readingStats === null) patch.readingStats = {};
  patch.collections = patch.collections
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({
      id: String(c.id || Math.random().toString(36).slice(2)),
      name: String(c.name || 'מדף'),
      bookIds: Array.isArray(c.bookIds) ? c.bookIds : [],
      createdAt: c.createdAt || Date.now(),
    }));
  if (!['dark', 'light'].includes(patch.theme)) patch.theme = 'dark';
  if (!['grid', 'list'].includes(patch.layout)) patch.layout = 'grid';

  state = { ...state, ...patch };
  applyTheme();
  emit();
  return state;
}

function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = state.theme;
  root.dataset.accent = state.accent;
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

let toastSeq = 0;
export function toast(message, kind = 'info') {
  toastSeq += 1;
  const id = `t-${toastSeq}-${Date.now()}`;
  setState({ toasts: [...state.toasts, { id, message, kind }] });
  setTimeout(() => {
    setState({ toasts: state.toasts.filter((t) => t.id !== id) });
  }, 4200);
}

/* ------------------------------------------------------------------ */
/* Library actions                                                     */
/* ------------------------------------------------------------------ */

export const bookById = (id) => state.books.find((b) => b.id === id) || null;

export function setView(view, detailBookId = null) {
  setState({ view, detailBookId });
}

export function setQuery(query) {
  setState({ query });
}

export function setSort(sort) {
  setState({ sort });
}

export function setLayout(layout) {
  setState({ layout });
}

export function setTheme(theme) {
  setState({ theme });
  applyTheme();
}

export function setAccent(accent) {
  setState({ accent });
  applyTheme();
}

export function toggleSidebar() {
  setState({ sidebarCollapsed: !state.sidebarCollapsed });
}

export function updateReader(patch) {
  setState({ reader: { ...state.reader, ...patch } });
}

function mergeBooks(newBooks) {
  const existing = new Map(state.books.map((b) => [b.id, b]));
  const added = [];
  for (const book of newBooks) {
    if (!existing.has(book.id)) added.push(book);
    existing.set(book.id, { ...existing.get(book.id), ...book });
  }
  const merged = [...existing.values()];
  setState({ books: merged });
  scheduleLibrarySave();
  return added;
}

export async function importFolders() {
  setState({ scanStatus: { phase: 'picking' } });
  try {
    const { paths, files } = await pickFolders();
    if (!paths.length && !files.length) {
      setState({ scanStatus: null });
      return;
    }
    if (paths.length) {
      setState({ scanStatus: { phase: 'scanning', done: 0, total: 0 } });
      const { default: platform } = await import('./platform.js');
      const scanned = await platformScan(paths);
      const added = mergeBooks(scanned);
      setState({
        folders: [...new Set([...state.folders, ...paths])],
        scanStatus: null,
      });
      toast(added.length ? `נוספו ${added.length} ספרים לספרייה` : 'לא נמצאו ספרים חדשים', added.length ? 'success' : 'info');
    } else if (files.length) {
      const scanned = await booksFromFiles(files);
      const added = mergeBooks(scanned);
      setState({ scanStatus: null });
      toast(added.length ? `נוספו ${added.length} ספרים לספרייה` : 'לא נמצאו קבצי ספרים', added.length ? 'success' : 'info');
    }
  } catch (err) {
    setState({ scanStatus: null });
    toast(`שגיאה בייבוא: ${err.message}`, 'error');
  }
}

async function platformScan(paths) {
  const bridge = typeof window !== 'undefined' && window.shoso;
  if (!bridge) return [];
  const onProgress = bridge.onScanProgress?.((p) => {
    setState({ scanStatus: { phase: 'scanning', done: p.done, total: p.total, file: p.file } });
  });
  try {
    return await bridge.scan(paths);
  } finally {
    if (typeof onProgress === 'function') onProgress();
  }
}

export async function importFiles() {
  try {
    const { paths, files } = await pickFiles();
    if (!paths.length && !files.length) return;
    if (paths.length) {
      const scanned = await platformScan(paths);
      const added = mergeBooks(scanned);
      toast(added.length ? `נוספו ${added.length} ספרים לספרייה` : 'לא נמצאו ספרים חדשים', added.length ? 'success' : 'info');
    } else if (files.length) {
      const scanned = await booksFromFiles(files);
      const added = mergeBooks(scanned);
      toast(added.length ? `נוספו ${added.length} ספרים לספרייה` : 'לא נמצאו קבצי ספרים', added.length ? 'success' : 'info');
    }
  } catch (err) {
    toast(`שגיאה בייבוא: ${err.message}`, 'error');
  }
}

export async function handleDrop(event) {
  event.preventDefault();
  const items = event.dataTransfer?.files;
  if (!items?.length) return;
  const files = Array.from(items);
  // Desktop: use real paths when available
  const paths = files.map((f) => pathForFile(f)).filter(Boolean);
  if (paths.length) {
    const scanned = await platformScan(paths);
    const added = mergeBooks(scanned);
    toast(added.length ? `נוספו ${added.length} ספרים לספרייה` : 'לא נמצאו ספרים חדשים', added.length ? 'success' : 'info');
    return;
  }
  const scanned = await booksFromFiles(files);
  const added = mergeBooks(scanned);
  toast(added.length ? `נוספו ${added.length} ספרים לספרייה` : 'לא נמצאו קבצי ספרים', added.length ? 'success' : 'info');
}

export function removeBook(bookId) {
  const book = bookById(bookId);
  const books = state.books.filter((b) => b.id !== bookId);
  const progress = { ...state.progress };
  delete progress[bookId];
  const bookmarks = { ...state.bookmarks };
  delete bookmarks[bookId];
  setState({
    books,
    favorites: state.favorites.filter((id) => id !== bookId),
    recent: state.recent.filter((id) => id !== bookId),
    collections: state.collections.map((c) => ({ ...c, bookIds: c.bookIds.filter((id) => id !== bookId) })),
    progress,
    bookmarks,
    currentBookId: state.currentBookId === bookId ? null : state.currentBookId,
  });
  scheduleLibrarySave();
  toast(`הספר "${book?.title || ''}" הוסר מהספרייה`, 'info');
}

export function removeFolder(folder) {
  setState({ folders: state.folders.filter((f) => f !== folder) });
  toast('התיקייה הוסרה מהרשימה (הקבצים לא נמחקו)', 'info');
}

export function toggleFavorite(bookId) {
  const isFav = state.favorites.includes(bookId);
  setState({
    favorites: isFav ? state.favorites.filter((id) => id !== bookId) : [...state.favorites, bookId],
  });
}

/* ------------------------------------------------------------------ */
/* Collections (shelves)                                               */
/* ------------------------------------------------------------------ */

export function createCollection(name) {
  const id = `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  setState({ collections: [...state.collections, { id, name: name.trim() || 'מדף חדש', bookIds: [], createdAt: Date.now() }] });
  return id;
}

export function renameCollection(id, name) {
  setState({ collections: state.collections.map((c) => (c.id === id ? { ...c, name } : c)) });
}

export function deleteCollection(id) {
  setState({ collections: state.collections.filter((c) => c.id !== id) });
}

export function toggleInCollection(collectionId, bookId) {
  setState({
    collections: state.collections.map((c) => {
      if (c.id !== collectionId) return c;
      const has = c.bookIds.includes(bookId);
      return { ...c, bookIds: has ? c.bookIds.filter((id) => id !== bookId) : [...c.bookIds, bookId] };
    }),
  });
}

/* ------------------------------------------------------------------ */
/* Reading progress & bookmarks                                        */
/* ------------------------------------------------------------------ */

export function openBook(bookId) {
  const recent = [bookId, ...state.recent.filter((id) => id !== bookId)].slice(0, 50);
  setState({ currentBookId: bookId, recent, view: 'reader' });
}

export function closeBook() {
  setState({ currentBookId: null, view: 'home' });
}

export function saveProgress(bookId, patch) {
  const prev = state.progress[bookId] || {};
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  // Clamp percent
  next.percent = Math.min(100, Math.max(0, Number(next.percent) || 0));
  setState({ progress: { ...state.progress, [bookId]: next } });
}

export function markFinished(bookId) {
  saveProgress(bookId, { percent: 100, finished: true });
  toast('סיימת לקרוא את הספר! 🎉', 'success');
}

export function addReadingTime(bookId, seconds) {
  const prev = state.readingStats[bookId] || 0;
  setState({ readingStats: { ...state.readingStats, [bookId]: prev + seconds } });
}

export function addBookmark(bookId, { chapter = 0, scroll = 0, page = 1, label = '' } = {}) {
  const list = state.bookmarks[bookId] || [];
  const id = `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const entry = { id, chapter, scroll, page, label: label || `סימנייה ${list.length + 1}`, createdAt: Date.now() };
  setState({ bookmarks: { ...state.bookmarks, [bookId]: [...list, entry] } });
  toast('הסימנייה נשמרה', 'success');
  return entry;
}

export function removeBookmark(bookId, bookmarkId) {
  const list = (state.bookmarks[bookId] || []).filter((b) => b.id !== bookmarkId);
  setState({ bookmarks: { ...state.bookmarks, [bookId]: list } });
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function filteredBooks() {
  const { books, query, sort, favorites, view } = state;
  let list = [...books];
  if (view === 'favorites') list = list.filter((b) => favorites.includes(b.id));
  if (query) {
    const q = query;
    list = list.filter((b) => matchesQuery(bookHaystack(b), q));
  }
  const dir = sort.dir === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case 'title': cmp = collate(a.title, b.title); break;
      case 'author': cmp = collate(a.author, b.author) || collate(a.title, b.title); break;
      case 'format': cmp = collate(a.format, b.format) || collate(a.title, b.title); break;
      case 'size': cmp = (a.size || 0) - (b.size || 0); break;
      case 'added': cmp = (a.addedAt || 0) - (b.addedAt || 0); break;
      case 'progress': {
        const pa = state.progress[a.id]?.percent || 0;
        const pb = state.progress[b.id]?.percent || 0;
        cmp = pa - pb;
        break;
      }
      default: cmp = collate(a.title, b.title);
    }
    return cmp * dir;
  });
  return list;
}

export function authorsList() {
  const map = new Map();
  for (const book of state.books) {
    const author = book.author || 'מחבר לא ידוע';
    if (!map.has(author)) map.set(author, []);
    map.get(author).push(book);
  }
  return [...map.entries()]
    .map(([author, books]) => ({ author, books, count: books.length }))
    .sort((a, b) => collate(a.author, b.author));
}

export function formatsList() {
  const map = new Map();
  for (const book of state.books) {
    const f = book.format || 'OTHER';
    if (!map.has(f)) map.set(f, []);
    map.get(f).push(book);
  }
  return [...map.entries()]
    .map(([format, books]) => ({ format, books, count: books.length }))
    .sort((a, b) => b.count - a.count);
}

export function continueReading() {
  const { recent, progress, books } = state;
  return recent
    .map((id) => ({ book: bookById(id), progress: progress[id] }))
    .filter((x) => x.book && x.progress && x.progress.percent > 0 && x.progress.percent < 100)
    .slice(0, 12);
}

export function totalReadingTime() {
  return Object.values(state.readingStats).reduce((sum, s) => sum + (Number(s) || 0), 0);
}

export function finishedCount() {
  return Object.values(state.progress).filter((p) => p.finished || p.percent >= 100).length;
}

export { normalize };
