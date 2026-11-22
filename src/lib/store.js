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
  onLibraryChanged,
} from './platform.js';
import { bookHaystack, matchesQuery, collate, normalize } from './format.js';
import { onCoverExtracted } from './covers.js';

export const READER_THEMES = ['light', 'sepia', 'dark', 'night', 'console'];
/** Readera colour modes, in Readera's own order. */
/** ReadEra's four colour modes, in ReadEra's order: Normal, Sepia, Night, Console. */
export const COLOR_MODES = [
  { id: 'light', label: 'רגיל' },
  { id: 'sepia', label: 'ספיה' },
  { id: 'dark', label: 'לילה' },
  { id: 'console', label: 'קונסול' },
];
/** The reader's font list, mirroring ReadEra's FONT FACE options. */
export const FONT_FAMILIES = [
  { id: 'serif', label: 'Merriweather', value: "'Merriweather', 'Noto Serif Hebrew', Georgia, serif" },
  { id: 'hebrew-serif', label: 'Noto Serif Hebrew', value: "'Noto Serif Hebrew', 'Merriweather', Georgia, serif" },
  { id: 'sans', label: 'Roboto', value: "'Roboto', 'Noto Sans Hebrew', system-ui, sans-serif" },
  { id: 'hebrew-sans', label: 'Noto Sans Hebrew', value: "'Noto Sans Hebrew', 'Roboto', system-ui, sans-serif" },
  { id: 'mono', label: 'Monospace', value: "'Consolas', 'Courier New', monospace" },
];

export const DEFAULT_READER = {
  theme: 'dark',
  fontSize: 18,
  fontWeight: 400,
  lineHeight: 1.7,
  fontFamily: 'serif',
  margins: 48,
  justify: false,
  hyphenation: true,
  mode: 'scroll', // 'scroll' (אנכי) | 'paginated' (אופקי)
  maxWidth: 900,
};

const DEFAULT_STATE = {
  books: [],
  folders: [],
  collections: [],
  favorites: [],
  toRead: [],
  recent: [],
  trash: [],
  progress: {}, // bookId -> { chapter, scroll, page, percent, updatedAt, finished, totalChapters, totalPages }
  bookmarks: {}, // bookId -> [{ id, chapter, scroll, page, label, createdAt }]
  readingStats: {}, // bookId -> seconds
  currentBookId: null,
  view: 'home',
  detailBookId: null,
  detailReturn: 'books', // where a detail screen was opened from
  theme: 'dark',
  accent: 'violet',
  sidebarCollapsed: false,
  drawerOpen: false,
  selection: [], // library selection mode, like ReadEra
  query: '',
  sort: { key: 'title', dir: 'asc' },
  layout: 'full', // ReadEra views: full | brief | thumbs | grid
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

const PERSISTED = new Set([
  'folders', 'collections', 'favorites', 'toRead', 'trash', 'recent',
  'progress', 'bookmarks', 'readingStats', 'view', 'theme', 'accent',
  'sidebarCollapsed', 'sort', 'layout', 'reader', 'currentBookId',
]);

function notify() {
  listeners.forEach((fn) => fn());
}

function emit(changedKeys) {
  notify();
  // Transient UI state (query, drawer, toasts, scrolling) must not trigger a
  // disk write – serialising the whole library on every keystroke was pure I/O.
  if (!changedKeys || changedKeys.some((key) => PERSISTED.has(key))) scheduleSave();
}

export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  emit(Object.keys(next));
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
  'folders', 'collections', 'favorites', 'toRead', 'trash', 'recent',
  'progress', 'bookmarks', 'readingStats', 'view', 'theme', 'accent',
  'sidebarCollapsed', 'sort', 'layout', 'reader', 'currentBookId',
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
    // Older desktop builds saved the browser demo books (blob: paths that die
    // with the process). They can never be opened again – drop them on load.
    patch.books = patch.books.filter((b) => !(isDesktop && b && b.dir === 'ספרי דמו' && String(b.path || '').startsWith('blob:')));
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
  patch.reader.fontWeight = num(patch.reader.fontWeight, 400, 300, 700);
  patch.reader.margins = num(patch.reader.margins, 48, 0, 120);
  patch.reader.maxWidth = num(patch.reader.maxWidth, 900, 480, 1100);
  if (!READER_THEMES.includes(patch.reader.theme)) patch.reader.theme = 'dark';
  if (!['scroll', 'paginated'].includes(patch.reader.mode)) patch.reader.mode = 'scroll';
  if (!patch.sort || typeof patch.sort !== 'object' || !patch.sort.key) {
    patch.sort = { key: 'title', dir: 'asc' };
  }
  for (const key of ['collections', 'favorites', 'toRead', 'trash', 'recent', 'folders']) {
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
  if (patch.layout === 'list') patch.layout = 'full';
  if (patch.layout === 'thumbnails') patch.layout = 'thumbs';
  if (!['full', 'brief', 'thumbs', 'grid'].includes(patch.layout)) patch.layout = 'full';

  state = { ...state, ...patch };
  applyTheme();
  emit();
  await seedDemoIfEmpty();
  followDisk();
  return state;
}

/**
 * The disk can change behind the reader's back: files copied into a watched
 * folder, renamed, deleted, or a folder that is not mounted right now. The
 * main-process scan is the single owner of that truth, so the library is
 * reconciled on start-up and whenever a folder reports a change.
 */
let following = false;
function followDisk() {
  if (!isDesktop || following) return;
  following = true;
  onLibraryChanged?.((folder) => {
    rescanLibrary({ folders: [folder], silent: true }).catch(() => {});
  });
  // A cover drawn at display time (a PDF's first page) is kept with the book.
  onCoverExtracted((bookId, url) => setBookCover(bookId, url));
  if (state.folders.length) {
    // after the first paint, so the window is usable immediately
    setTimeout(() => { rescanLibrary({ silent: true }).catch(() => {}); }, 400);
  }
}

/**
 * Browser builds start empty (there is no filesystem to scan), so seed the
 * demo library once so the app – and the CI screenshots – show real content.
 * Desktop builds never do this: they scan real folders.
 */
async function seedDemoIfEmpty() {
  if (typeof window === 'undefined') return;
  if (import.meta.env && import.meta.env.VITEST) return;
  // Demo books belong to the browser preview only. In the installed app they
  // looked like real books that the reader never added – and they came back
  // every time the library was emptied.
  if (isDesktop) return;
  if (state.books.length) return;
  if (window.localStorage?.getItem('shoso:no-demo') === '1') return;
  try {
    const { createDemoBooks } = await import('./demo.js');
    mergeBooks(await createDemoBooks());
  } catch (err) {
    // A missing demo is not fatal – the empty state still works.
    // eslint-disable-next-line no-console
    console.warn('demo seed skipped', err);
  }
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

/** id -> book index, rebuilt only when the books array itself is replaced. */
let indexSource = null;
let bookIndex = new Map();

const indexOf = () => {
  if (indexSource !== state.books) {
    indexSource = state.books;
    bookIndex = new Map(state.books.map((b) => [b.id, b]));
  }
  return bookIndex;
};

export const bookById = (id) => (id ? indexOf().get(id) || null : null);

/**
 * Screens that hang off a list (a book, an author, a format, a shelf). They
 * remember where they were opened from so the back arrow – and closing the
 * reader – land where the reader expects.
 */
const DETAIL_VIEWS = new Set(['book', 'author', 'format', 'collection']);

export function setView(view, detailBookId = null) {
  const patch = { view, detailBookId, selection: [] };
  if (DETAIL_VIEWS.has(view)) {
    patch.detailReturn = DETAIL_VIEWS.has(state.view) ? state.detailReturn || 'books' : state.view;
  }
  setState(patch);
}

/** Step back out of a detail screen, to wherever it was opened from. */
export function goBack() {
  setView(state.detailReturn || 'books');
}

/** The middle step between the library and the reader: the book description. */
export function openBookDetails(bookId) {
  setView('book', bookId);
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

/** Readera's navigation drawer (overlay, not a docked column). */
/* ------------------------------------------------------------------ */
/* Selection (ReadEra's tap-to-select in the library)                  */
/* ------------------------------------------------------------------ */

export const selectionIds = () => state.selection;

export function toggleSelect(bookId) {
  const has = state.selection.includes(bookId);
  setState({ selection: has ? state.selection.filter((id) => id !== bookId) : [...state.selection, bookId] });
}

export function clearSelection() {
  if (state.selection.length) setState({ selection: [] });
}

export function selectAll(ids) {
  setState({ selection: [...ids] });
}

export function openSelection() {
  const id = state.selection[0];
  if (!id) return;
  setState({ selection: [] });
  openBookFrom(id, state.view);
}

export function deleteSelection() {
  const ids = state.selection;
  if (!ids.length) return;
  const books = state.books.filter((b) => !ids.includes(b.id));
  const progress = { ...state.progress };
  const bookmarks = { ...state.bookmarks };
  ids.forEach((id) => {
    delete progress[id];
    delete bookmarks[id];
  });
  const removed = state.books.filter((b) => ids.includes(b.id)).map((b) => ({ ...b, removedAt: Date.now() }));
  setState({
    books,
    progress,
    bookmarks,
    trash: [...removed, ...state.trash].slice(0, 200),
    favorites: state.favorites.filter((id) => !ids.includes(id)),
    toRead: state.toRead.filter((id) => !ids.includes(id)),
    recent: state.recent.filter((id) => !ids.includes(id)),
    collections: state.collections.map((c) => ({ ...c, bookIds: c.bookIds.filter((id) => !ids.includes(id)) })),
    selection: [],
  });
  scheduleLibrarySave();
  toast(ids.length === 1 ? 'הספר הועבר לאשפה' : `${ids.length} ספרים הועברו לאשפה`, 'info');
}

export function addSelectionToCollection(collectionId) {
  const ids = state.selection;
  if (!ids.length) return;
  setState({
    collections: state.collections.map((c) => (
      c.id === collectionId ? { ...c, bookIds: [...new Set([...c.bookIds, ...ids])] } : c
    )),
    selection: [],
  });
  const name = state.collections.find((c) => c.id === collectionId)?.name || 'מדף';
  toast(`נוסף ל${name}`, 'success');
}

export function toggleSidebar(force) {
  const next = typeof force === 'boolean' ? force : !state.drawerOpen;
  setState({ drawerOpen: next });
}

export function closeDrawer() {
  if (state.drawerOpen) setState({ drawerOpen: false });
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
      const scanned = (await runScan(paths)).books;
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

/**
 * The main process owns scanning: it walks the folders, reads each file once
 * (metadata + cover) and says which folders it could actually read. This
 * wrapper only forwards the request and normalises the answer.
 */
async function runScan(paths) {
  const bridge = typeof window !== 'undefined' && window.shoso;
  if (!bridge) return { books: [], folders: [] };
  const onProgress = bridge.onScanProgress?.((p) => {
    setState({ scanStatus: { phase: 'scanning', done: p.done, total: p.total, file: p.file } });
  });
  try {
    // Hand the previous entries over so an unchanged file is not re-parsed.
    const known = state.books.filter((b) => b.path).map((b) => ({ ...b }));
    const result = await bridge.scan(paths, known);
    return Array.isArray(result) ? { books: result, folders: paths } : { books: result.books || [], folders: result.folders || [] };
  } finally {
    if (typeof onProgress === 'function') onProgress();
  }
}

const flatPath = (value) => String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');

const underFolder = (bookPath, folder) => {
  const book = flatPath(bookPath);
  const root = flatPath(folder);
  return Boolean(book && root) && (book === root || book.startsWith(`${root}/`));
};

/**
 * Pure reconciliation step: given what the library holds and what a scan found,
 * decide what stays, what is new and what is gone. Books that were imported one
 * by one (not from a scanned folder) are never touched, and a folder that did
 * not answer keeps its books.
 */
export function reconcileBooks({ books, scanned, folders }) {
  const seen = new Set(scanned.map((b) => b.id));
  const existing = new Map(books.map((b) => [b.id, b]));
  const reachable = folders && folders.length ? folders : [];
  const fromScanned = (book) => reachable.some((folder) => underFolder(book.path, folder));

  let added = 0;
  const merged = [];
  for (const book of scanned) {
    const before = existing.get(book.id);
    if (before) merged.push({ ...before, ...book, addedAt: before.addedAt || book.addedAt });
    else {
      added += 1;
      merged.push(book);
    }
  }

  const gone = books.filter((b) => (
    b.path
    && !String(b.path).startsWith('blob:')
    && !seen.has(b.id)
    && fromScanned(b)
  ));
  const goneIds = new Set(gone.map((b) => b.id));
  const kept = books.filter((b) => !goneIds.has(b.id) && !fromScanned(b));

  return { books: [...merged, ...kept], added, removed: gone.length, removedIds: [...goneIds] };
}

/**
 * Bring the library in line with what is on disk: new files appear, changed
 * files are refreshed, and books whose file is gone leave the library – but
 * only for folders that answered, so an unplugged drive never empties it.
 */
export async function rescanLibrary({ folders = null, silent = false } = {}) {
  if (!isDesktop) return { added: 0, removed: 0 };
  const targets = folders && folders.length ? folders : state.folders;
  if (!targets.length) return { added: 0, removed: 0 };

  setState({ scanStatus: { phase: 'scanning', done: 0, total: 0 } });
  let added = 0;
  let removed = 0;
  try {
    const { books: scanned, folders: reachable } = await runScan(targets);
    if (!reachable.length) return { added: 0, removed: 0 };

    const result = reconcileBooks({ books: state.books, scanned, folders: reachable });
    const books = result.books;
    added = result.added;
    removed = result.removed;

    const ids = new Set(books.map((b) => b.id));
    const without = (list) => list.filter((id) => ids.has(id));

    setState({
      books,
      favorites: without(state.favorites),
      toRead: without(state.toRead),
      recent: without(state.recent),
      collections: state.collections.map((c) => ({ ...c, bookIds: c.bookIds.filter((id) => ids.has(id)) })),
      scanStatus: null,
    });
    scheduleLibrarySave();

    if (!silent && (added || removed)) {
      const parts = [];
      if (added) parts.push(`נוספו ${added}`);
      if (removed) parts.push(`הוסרו ${removed} שקבציהם לא נמצאו`);
      toast(parts.join(' · '), 'info');
    }
    return { added, removed };
  } catch (err) {
    setState({ scanStatus: null });
    if (!silent) toast(`שגיאה בסריקה: ${err.message}`, 'error');
    return { added: 0, removed: 0 };
  }
}

/** A cover extracted at display time (a PDF's first page) is stored for good. */
export function setBookCover(bookId, coverUrl) {
  if (!coverUrl) return;
  const current = bookById(bookId);
  if (!current || current.cover === coverUrl || String(current.cover || '').startsWith('data:')) return;
  setState({
    books: state.books.map((b) => (b.id === bookId ? { ...b, cover: coverUrl, coverChecked: true } : b)),
  });
  scheduleLibrarySave();
}

export async function importFiles() {
  try {
    const { paths, files } = await pickFiles();
    if (!paths.length && !files.length) return;
    if (paths.length) {
      const scanned = (await runScan(paths)).books;
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
    const scanned = (await runScan(paths)).books;
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
  const trash = book
    ? [{ ...book, removedAt: Date.now() }, ...state.trash.filter((b) => b.id !== bookId)].slice(0, 200)
    : state.trash;
  setState({
    books,
    trash,
    favorites: state.favorites.filter((id) => id !== bookId),
    toRead: state.toRead.filter((id) => id !== bookId),
    recent: state.recent.filter((id) => id !== bookId),
    collections: state.collections.map((c) => ({ ...c, bookIds: c.bookIds.filter((id) => id !== bookId) })),
    progress,
    bookmarks,
    currentBookId: state.currentBookId === bookId ? null : state.currentBookId,
  });
  scheduleLibrarySave();
  toast(`"${book?.title || ''}" הועבר לאשפה`, 'info');
}

/** Readera's Trash: restore a book back into the library. */
export function restoreBook(bookId) {
  const book = state.trash.find((b) => b.id === bookId);
  if (!book) return;
  const clean = { ...book };
  delete clean.removedAt;
  setState({
    books: [...state.books, clean],
    trash: state.trash.filter((b) => b.id !== bookId),
  });
  scheduleLibrarySave();
  toast(`"${book.title}" שוחזר לספרייה`, 'success');
}

/** Permanently delete one trashed book, or empty the whole trash. */
export function purgeBook(bookId = null) {
  setState({ trash: bookId ? state.trash.filter((b) => b.id !== bookId) : [] });
  toast(bookId ? 'הספר נמחק לצמיתות' : 'האשפה רוקנה', 'info');
}

/** Readera's "To Read" list toggle. */
export function toggleToRead(bookId) {
  const has = state.toRead.includes(bookId);
  setState({
    toRead: has ? state.toRead.filter((id) => id !== bookId) : [...state.toRead, bookId],
  });
}

/** Readera's "Have Read" toggle — marks a book finished / unfinished. */
export function toggleHaveRead(bookId) {
  const p = state.progress[bookId] || {};
  const done = Boolean(p.finished) || (p.percent || 0) >= 100;
  setState({
    progress: {
      ...state.progress,
      [bookId]: done
        ? { ...p, percent: 0, finished: false, updatedAt: Date.now() }
        : { ...p, percent: 100, finished: true, updatedAt: Date.now() },
    },
  });
}

/**
 * Removing a watched folder removes the books that came with it – otherwise the
 * library kept listing books from a folder nobody was watching any more. The
 * files themselves are never touched, and the books land in the trash.
 */
export function removeFolder(folder) {
  const flat = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const foldered = flat(folder);
  const inside = (b) => {
    const bookPath = flat(b && b.path);
    if (!bookPath || bookPath.startsWith('blob:')) return false;
    return bookPath === foldered || bookPath.startsWith(`${foldered}/`);
  };
  const leaving = state.books.filter(inside);
  const ids = leaving.map((b) => b.id);
  const trash = [...leaving.map((b) => ({ ...b, removedAt: Date.now() })), ...state.trash].slice(0, 200);
  const progress = { ...state.progress };
  const bookmarks = { ...state.bookmarks };
  ids.forEach((id) => { delete progress[id]; delete bookmarks[id]; });
  setState({
    folders: state.folders.filter((f) => f !== folder),
    books: state.books.filter((b) => !ids.includes(b.id)),
    trash,
    progress,
    bookmarks,
    favorites: state.favorites.filter((id) => !ids.includes(id)),
    toRead: state.toRead.filter((id) => !ids.includes(id)),
    recent: state.recent.filter((id) => !ids.includes(id)),
    collections: state.collections.map((c) => ({ ...c, bookIds: c.bookIds.filter((id) => !ids.includes(id)) })),
  });
  scheduleLibrarySave();
  toast(
    ids.length
      ? `התיקייה הוסרה · ${ids.length} ספרים עברו לאשפה (הקבצים עצמם לא נמחקו)`
      : 'התיקייה הוסרה מהרשימה (הקבצים לא נמחקו)',
    'info',
  );
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
  setState({ currentBookId: null, view: state.returnView || 'books' });
}

/** Which screen to show when the reader closes. */
export function openBookFrom(bookId, fromView) {
  const recent = [bookId, ...state.recent.filter((id) => id !== bookId)].slice(0, 50);
  setState({ currentBookId: bookId, recent, returnView: fromView, view: 'reader' });
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

/**
 * The library screen asks for this on every render; the result only changes when
 * one of its inputs does, so the filter + sort (O(n log n)) runs once per change
 * instead of once per repaint.
 */
let filterCache = null;

export function filteredBooks() {
  const { books, query, sort, favorites, view } = state;
  const key = `${query}\u0000${view}\u0000${sort.key}\u0000${sort.dir}`;
  if (
    filterCache
    && filterCache.books === books
    && filterCache.favorites === favorites
    && filterCache.progress === state.progress
    && filterCache.key === key
  ) {
    return filterCache.list;
  }
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
  filterCache = { books, favorites, progress: state.progress, key, list };
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

export function toReadBooks() {
  return state.toRead.map((id) => bookById(id)).filter(Boolean);
}

export function haveReadBooks() {
  return state.books
    .filter((b) => {
      const p = state.progress[b.id];
      return p && (p.finished || p.percent >= 100);
    })
    .sort((a, b) => (state.progress[b.id]?.updatedAt || 0) - (state.progress[a.id]?.updatedAt || 0));
}

export function continuingBooks() {
  return [...state.books]
    .filter((b) => {
      const p = state.progress[b.id];
      return p && p.percent > 0 && p.percent < 100;
    })
    .sort((a, b) => (state.progress[b.id]?.updatedAt || 0) - (state.progress[a.id]?.updatedAt || 0));
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
