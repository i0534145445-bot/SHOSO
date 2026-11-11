/**
 * Application store – a tiny observable state container (no external deps).
 *
 * Holds the music library, playlists, playback queue and user settings, wires
 * them to the audio engine and persists everything (Electron: JSON in
 * %APPDATA%/SHOSO Music, browser: localStorage).
 */

import { useRef, useSyncExternalStore } from 'react';
import { engine, EQ_FREQUENCIES, EQ_PRESETS } from './audio.js';
import {
  initPlatform,
  appInfo,
  isDesktop,
  mediaUrl,
  loadPersistedState,
  savePersistedState,
  loadPersistedLibrary,
  savePersistedLibrary,
  tracksFromFiles,
  pickFolders,
  pickFiles,
  pathForFile,
} from './platform.js';
import { primaryArtist, artistsOf, normalize, matchesQuery, trackHaystack, collate } from './format.js';

export const REPEAT_MODES = ['off', 'all', 'one'];

const DEFAULT_STATE = {
  tracks: [],
  folders: [],
  playlists: [],
  favorites: [],
  history: [],
  queue: [],
  queueIndex: -1,
  currentId: null,
  playing: false,
  time: 0,
  duration: 0,
  volume: 0.85,
  muted: false,
  shuffle: false,
  repeat: 'off',
  rate: 1,
  eqEnabled: true,
  eqGains: EQ_FREQUENCIES.map(() => 0),
  eqPreset: 'שטוח',
  preamp: 0,
  view: 'home',
  theme: 'dark',
  accent: 'violet',
  sidebarCollapsed: false,
  query: '',
  sort: { key: 'title', dir: 'asc' },
  showLyrics: false,
  visualizer: 'bars',
  lastVolume: 0.85,
  scanStatus: null,
  toasts: [],
  customCovers: {},
  abRepeat: { a: null, b: null },
  sleepTimer: null,
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

/**
 * Selector hook with cached snapshots – required because many selectors build
 * derived arrays (albums, artists…) that would otherwise get a new identity on
 * every render and trip React's update-depth guard.
 */
export function useStore(selector = (s) => s) {
  const cache = useRef({ state: null, value: undefined });

  const getSnapshot = () => {
    const current = cache.current;
    if (current.state !== state) {
      const next = selector(state);
      // Keep the previous reference when the derived value is unchanged, so
      // selectors that build arrays (albums, artists, …) stay render-stable.
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
  'folders', 'playlists', 'favorites', 'history', 'volume', 'muted', 'shuffle', 'repeat',
  'rate', 'eqEnabled', 'eqGains', 'eqPreset', 'preamp', 'view', 'theme', 'accent',
  'sidebarCollapsed', 'sort', 'visualizer', 'lastVolume', 'customCovers', 'queue', 'queueIndex',
  'currentId', 'abRepeat',
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
    if (isDesktop) savePersistedLibrary({ tracks: state.tracks, savedAt: Date.now() });
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
  if (savedLibrary && Array.isArray(savedLibrary.tracks) && savedLibrary.tracks.length) {
    patch.tracks = savedLibrary.tracks;
  }
  if (patch.tracks) {
    // Drop stale queue entries that no longer exist in the library.
    const ids = new Set(patch.tracks.map((t) => t.id));
    patch.queue = (patch.queue || []).filter((id) => ids.has(id));
    if (patch.currentId && !ids.has(patch.currentId)) {
      patch.currentId = null;
      patch.queueIndex = -1;
    }
  }
  if (!patch.currentId) patch.playing = false;

  state = { ...state, ...patch };
  attachEngine();
  applyTheme();
  engine.setVolume(state.muted ? 0 : state.volume);
  engine.setEqGains(state.eqGains);
  engine.setEqEnabled(state.eqEnabled);
  engine.setPreamp(state.preamp);
  engine.setRate(state.rate);

  if (state.currentId) {
    const track = trackById(state.currentId);
    if (track) {
      // Restore the last track without starting playback.
      state = { ...state, duration: track.duration || 0, time: 0 };
      engine.load(mediaUrl(track), { autoplay: false }).catch(() => {});
    }
  }
  emit();
  return state;
}

function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = state.theme;
  root.dataset.accent = state.accent;
  root.dataset.visualizer = state.visualizer;
}

/* ------------------------------------------------------------------ */
/* Engine wiring                                                       */
/* ------------------------------------------------------------------ */

let engineAttached = false;

function attachEngine() {
  if (engineAttached) return;
  engineAttached = true;
  engine.subscribe((type) => {
    if (type === 'time') {
      state = { ...state, time: engine.time, duration: engine.duration || state.duration };
      notify();
      enforceABRepeat();
    } else if (type === 'duration') {
      state = { ...state, duration: engine.duration };
      notify();
    } else if (type === 'play') {
      state = { ...state, playing: true };
      notify();
    } else if (type === 'pause') {
      state = { ...state, playing: false };
      notify();
    } else if (type === 'ended') {
      handleTrackEnded();
    } else if (type === 'error') {
      toast('לא ניתן לנגן את הקובץ הזה', 'error');
      state = { ...state, playing: false };
      notify();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export const trackById = (id) => state.tracks.find((t) => t.id === id) || null;

export const currentTrack = () => (state.currentId ? trackById(state.currentId) : null);

export const isFavorite = (id) => state.favorites.includes(id);

export const playlistById = (id) => state.playlists.find((p) => p.id === id) || null;

export const tracksForPlaylist = (playlist) =>
  playlist.trackIds.map((id) => trackById(id)).filter(Boolean);

export function albums() {
  const map = new Map();
  for (const track of state.tracks) {
    const key = `${track.albumArtist || track.artist}||${track.album}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        album: track.album || 'אלבום לא ידוע',
        artist: track.albumArtist || primaryArtist(track),
        year: track.year,
        picture: track.picture,
        tracks: [],
        duration: 0,
      });
    }
    const album = map.get(key);
    album.tracks.push(track);
    album.duration += track.duration || 0;
    if (!album.picture && track.picture) album.picture = track.picture;
    if (!album.year && track.year) album.year = track.year;
  }
  const list = [...map.values()];
  list.forEach((album) => {
    album.tracks.sort((a, b) => (a.discNo - b.discNo) || (a.trackNo - b.trackNo) || collate(a.title, b.title));
  });
  return list.sort((a, b) => collate(a.artist, b.artist) || collate(a.album, b.album));
}

export function artists() {
  const map = new Map();
  for (const track of state.tracks) {
    const names = artistsOf(track).length ? artistsOf(track) : [track.artist || 'אמן לא ידוע'];
    for (const name of names) {
      const key = normalize(name);
      if (!map.has(key)) {
        map.set(key, { key, name, tracks: [], albumKeys: new Set(), picture: track.picture, duration: 0, albumCount: 0 });
      }
      const artist = map.get(key);
      artist.tracks.push(track);
      artist.albumKeys.add(`${track.albumArtist || track.artist}||${track.album}`);
      artist.duration += track.duration || 0;
      if (!artist.picture && track.picture) artist.picture = track.picture;
    }
  }
  const list = [...map.values()];
  list.forEach((artist) => {
    artist.albumCount = artist.albumKeys.size;
    delete artist.albumKeys;
  });
  return list.sort((a, b) => collate(a.name, b.name));
}

export function genres() {
  const map = new Map();
  for (const track of state.tracks) {
    const list = String(track.genre || '')
      .split(/[,/;]/)
      .map((g) => g.trim())
      .filter(Boolean);
    if (!list.length) list.push('ללא ז׳אנר');
    for (const genre of list) {
      if (!map.has(genre)) map.set(genre, { name: genre, tracks: [], picture: track.picture });
      const entry = map.get(genre);
      entry.tracks.push(track);
      if (!entry.picture) entry.picture = track.picture;
    }
  }
  return [...map.values()].sort((a, b) => b.tracks.length - a.tracks.length);
}

export function folderGroups() {
  const map = new Map();
  for (const track of state.tracks) {
    const dir = track.dir || '';
    if (!map.has(dir)) {
      map.set(dir, { dir, name: dir.split(/[\\/]/).filter(Boolean).pop() || dir, tracks: [] });
    }
    map.get(dir).tracks.push(track);
  }
  return [...map.values()].sort((a, b) => collate(a.name, b.name));
}

export function filteredTracks(list = state.tracks, query = state.query) {
  if (!query) return list;
  return list.filter((track) => matchesQuery(trackHaystack(track), query));
}

export function sortTracks(list, sort = state.sort) {
  const dir = sort.dir === 'desc' ? -1 : 1;
  const sorted = [...list];
  sorted.sort((a, b) => {
    let result;
    switch (sort.key) {
      case 'artist':
        result = collate(a.artist, b.artist) || collate(a.album, b.album) || (a.trackNo - b.trackNo);
        break;
      case 'album':
        result = collate(a.album, b.album) || (a.discNo - b.discNo) || (a.trackNo - b.trackNo);
        break;
      case 'duration':
        result = (a.duration || 0) - (b.duration || 0);
        break;
      case 'year':
        result = String(a.year).localeCompare(String(b.year));
        break;
      case 'added':
        result = (a.mtime || 0) - (b.mtime || 0);
        break;
      case 'title':
      default:
        result = collate(a.title, b.title) || collate(a.artist, b.artist);
    }
    return result * dir;
  });
  return sorted;
}

/* ------------------------------------------------------------------ */
/* Navigation helpers                                                  */
/* ------------------------------------------------------------------ */

export function setView(view) {
  setState({ view });
}

export function openPlaylist(id) {
  window.__shosoSelectedPlaylist = id;
  window.dispatchEvent(new CustomEvent('shoso:open-playlist', { detail: id }));
  setView('playlist');
}

export function openAlbum(album) {
  window.__shosoAlbum = album;
  window.dispatchEvent(new CustomEvent('shoso:open-album', { detail: album }));
  setView('album');
}

export function openArtist(name) {
  window.__shosoArtist = name;
  window.dispatchEvent(new CustomEvent('shoso:open-artist', { detail: name }));
  setView('artist');
}

/* ------------------------------------------------------------------ */
/* Library operations                                                  */
/* ------------------------------------------------------------------ */

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function importFolders() {
  const { paths, files } = await pickFolders();
  if (paths.length && isDesktop) {
    await importPaths(paths);
    return;
  }
  if (files.length) await importBrowserFiles(files);
}

export async function importFiles() {
  const { paths, files } = await pickFiles();
  if (paths.length && isDesktop) {
    await importPaths(paths);
    return;
  }
  if (files.length) await importBrowserFiles(files);
}

export async function importPaths(paths) {
  if (!paths.length || !isDesktop) return;
  setState({ scanStatus: { phase: 'scanning', done: 0, total: 0, folder: paths[0] } });
  const off = window.shoso.onScanProgress((p) => {
    setState({ scanStatus: { phase: 'scanning', ...p } });
  });
  try {
    const found = await window.shoso.scan(paths);
    mergeTracks(found);
    const newFolders = paths.filter((p) => !state.folders.includes(p));
    setState({
      folders: [...state.folders, ...newFolders],
      scanStatus: { phase: 'done', added: found.length },
    });
    toast(`נוספו ${found.length} שירים לספרייה`, 'success');
  } catch (err) {
    setState({ scanStatus: null });
    toast(`שגיאה בסריקה: ${err.message}`, 'error');
  } finally {
    off && off();
    setTimeout(() => setState({ scanStatus: null }), 2500);
  }
}

export async function importBrowserFiles(files) {
  setState({ scanStatus: { phase: 'scanning', done: 0, total: files.length, folder: '' } });
  const tracks = await tracksFromFiles(files);
  mergeTracks(tracks);
  setState({ scanStatus: { phase: 'done', added: tracks.length } });
  toast(`נוספו ${tracks.length} שירים`, 'success');
  setTimeout(() => setState({ scanStatus: null }), 2500);
}

export function mergeTracks(incoming) {
  if (!incoming.length) return;
  const byId = new Map(state.tracks.map((t) => [t.id, t]));
  for (const track of incoming) byId.set(track.id, { ...byId.get(track.id), ...track });
  const tracks = [...byId.values()];
  state = { ...state, tracks };
  emit();
  scheduleLibrarySave();
}

export async function rescanLibrary() {
  if (!state.folders.length) {
    toast('לא הוגדרו תיקיות לסריקה', 'info');
    return;
  }
  if (!isDesktop) {
    toast('סריקה מחדש זמינה באפליקציית ווינדוס', 'info');
    return;
  }
  await importPaths(state.folders);
}

export async function removeLibrary() {
  state = {
    ...state,
    tracks: [],
    folders: [],
    queue: [],
    queueIndex: -1,
    currentId: null,
    playing: false,
    time: 0,
    duration: 0,
    favorites: [],
    playlists: state.playlists.map((p) => ({ ...p, trackIds: [] })),
  };
  engine.stop();
  emit();
  scheduleLibrarySave();
  toast('הספרייה רוקנה', 'info');
}

export async function rescanTrack(id) {
  const track = trackById(id);
  if (!track || !isDesktop || !track.path) return;
  try {
    const fresh = await window.shoso.refreshTrack(track.path);
    mergeTracks([{ ...track, ...fresh }]);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Playback                                                            */
/* ------------------------------------------------------------------ */

let playToken = 0;

export async function playTrack(trackOrId, { queue = null, startAt = 0 } = {}) {
  const track = typeof trackOrId === 'string' ? trackById(trackOrId) : trackOrId;
  if (!track) return;

  let nextQueue = queue;
  if (!nextQueue) {
    nextQueue = state.queue.includes(track.id) ? state.queue : state.tracks.map((t) => t.id);
  }
  let index = nextQueue.indexOf(track.id);
  if (index === -1) {
    nextQueue = [track.id, ...nextQueue];
    index = 0;
  }

  const token = ++playToken;
  state = {
    ...state,
    queue: [...nextQueue],
    queueIndex: index,
    currentId: track.id,
    duration: track.duration || 0,
    time: startAt,
    playing: true,
  };
  emit();

  try {
    await engine.load(mediaUrl(track), { autoplay: true, startAt });
  } catch {
    /* engine emits error */
  }
  if (token !== playToken) return;
  recordHistory(track.id);
}

export function playQueue(trackIds, startIndex = 0) {
  if (!trackIds.length) return;
  const track = trackById(trackIds[startIndex]);
  if (track) playTrack(track, { queue: trackIds });
}

export function togglePlay() {
  if (!state.currentId) {
    const first = state.tracks[0];
    if (first) playTrack(first);
    return;
  }
  // `state.playing` is kept in sync by the engine's play/pause events, which is
  // more reliable than reading HTMLMediaElement.paused right after a seek/reload.
  if (state.playing) {
    engine.pause();
    setState({ playing: false });
  } else {
    engine.play();
    engine.resume();
    setState({ playing: true });
  }
}

export function nextTrack({ user = true } = {}) {
  if (!state.queue.length) return;
  let index = state.queueIndex;
  if (state.shuffle) {
    if (state.queue.length === 1) index = 0;
    else {
      let candidate = index;
      for (let i = 0; i < 30 && candidate === index; i += 1) {
        candidate = Math.floor(Math.random() * state.queue.length);
      }
      index = candidate;
    }
  } else {
    index += 1;
    if (index >= state.queue.length) {
      if (state.repeat === 'all') index = 0;
      else {
        if (user) engine.pause();
        setState({ playing: false, time: 0 });
        return;
      }
    }
  }
  const track = trackById(state.queue[index]);
  if (track) playTrack(track, { queue: state.queue });
}

export function prevTrack() {
  if (!state.queue.length) return;
  if (engine.time > 4) {
    engine.seek(0);
    return;
  }
  let index = state.queueIndex - 1;
  if (index < 0) index = state.repeat === 'all' ? state.queue.length - 1 : 0;
  const track = trackById(state.queue[index]);
  if (track) playTrack(track, { queue: state.queue });
}

function handleTrackEnded() {
  if (state.repeat === 'one') {
    engine.seek(0);
    engine.play();
    return;
  }
  nextTrack({ user: false });
}

export function seekTo(seconds) {
  engine.seek(seconds);
  setState({ time: seconds });
}

/** Current playback position (engine is the source of truth, state may lag 250ms). */
export const playbackPosition = () => (engine.time > 0 ? engine.time : state.time);

export function seekBy(delta) {
  seekTo(Math.max(0, Math.min(engine.duration || state.duration, engine.time + delta)));
}

export function setVolume(value) {
  const volume = Math.max(0, Math.min(1, value));
  engine.setVolume(volume);
  setState({ volume, muted: false, lastVolume: volume > 0 ? volume : state.lastVolume });
}

export function toggleMute() {
  const muted = !state.muted;
  engine.setVolume(muted ? 0 : state.volume || state.lastVolume);
  setState({ muted });
}

export function toggleShuffle() {
  setState({ shuffle: !state.shuffle });
}

export function cycleRepeat() {
  const index = REPEAT_MODES.indexOf(state.repeat);
  setState({ repeat: REPEAT_MODES[(index + 1) % REPEAT_MODES.length] });
}

export function setRate(value) {
  engine.setRate(value);
  setState({ rate: value });
}

export function clearQueue() {
  state = { ...state, queue: state.currentId ? [state.currentId] : [], queueIndex: 0 };
  emit();
}

export function playNext(id) {
  const queue = [...state.queue];
  const existing = queue.indexOf(id);
  if (existing !== -1) queue.splice(existing, 1);
  const insertAt = Math.max(0, state.queueIndex + 1);
  queue.splice(insertAt, 0, id);
  state = { ...state, queue };
  emit();
  toast('השיר יתנגן בהמשך', 'success');
}

export function addToQueue(id) {
  if (state.queue.includes(id)) {
    toast('השיר כבר בתור', 'info');
    return;
  }
  setState({ queue: [...state.queue, id] });
  toast('נוסף לתור', 'success');
}

export function removeFromQueue(index) {
  const queue = [...state.queue];
  queue.splice(index, 1);
  const queueIndex = index < state.queueIndex ? state.queueIndex - 1 : state.queueIndex;
  setState({ queue, queueIndex: Math.max(-1, queueIndex) });
}

/* ------------------------------------------------------------------ */
/* A-B repeat + sleep timer                                            */
/* ------------------------------------------------------------------ */

/** Loop between the A and B markers while both are set. */
function enforceABRepeat() {
  const { a, b } = state.abRepeat || {};
  if (a == null || b == null || b <= a) return;
  if (engine.time >= b - 0.05) engine.seek(a);
}

export function setABPoint(point) {
  const ab = { ...state.abRepeat };
  const now = Math.round(playbackPosition() * 10) / 10;
  // A valid loop needs A < B; drop the older marker if the new one would invert them.
  if (point === 'a') {
    if (ab.b != null && now >= ab.b) ab.b = null;
    ab.a = now;
  } else {
    if (ab.a != null && now <= ab.a) ab.a = null;
    ab.b = now;
  }
  setState({ abRepeat: ab });
  toast(point === 'a' ? `נקודה A נקבעה ב־${now.toFixed(1)}s` : `נקודה B נקבעה ב־${now.toFixed(1)}s`, 'info');
}

export function clearABRepeat() {
  setState({ abRepeat: { a: null, b: null } });
  toast('חזרה A-B בוטלה', 'info');
}

let sleepInterval = null;

export function setSleepTimer(minutes) {
  if (!minutes) {
    clearInterval(sleepInterval);
    sleepInterval = null;
    setState({ sleepTimer: null });
    toast('טיימר השינה בוטל', 'info');
    return;
  }
  clearInterval(sleepInterval);
  const endAt = Date.now() + minutes * 60000;
  setState({ sleepTimer: { endAt, minutes } });
  toast(`טיימר שינה: ${minutes} דקות`, 'success');
  sleepInterval = setInterval(() => {
    const remaining = state.sleepTimer ? state.sleepTimer.endAt - Date.now() : 0;
    if (remaining <= 0) {
      engine.pause();
      clearInterval(sleepInterval);
      sleepInterval = null;
      setState({ sleepTimer: null, playing: false });
      toast('טיימר השינה הסתיים – הנגן הושהה', 'info');
    } else {
      notify();
    }
  }, 1000);
}

export const sleepRemaining = () =>
  state.sleepTimer ? Math.max(0, Math.round((state.sleepTimer.endAt - Date.now()) / 1000)) : 0;

/* ------------------------------------------------------------------ */
/* Favourites, playlists, history                                      */
/* ------------------------------------------------------------------ */

export function toggleFavorite(id) {
  const exists = state.favorites.includes(id);
  setState({ favorites: exists ? state.favorites.filter((f) => f !== id) : [id, ...state.favorites] });
  toast(exists ? 'הוסר מהמועדפים' : 'נוסף למועדפים', exists ? 'info' : 'success');
}

function recordHistory(id) {
  const history = [{ id, at: Date.now() }, ...state.history.filter((h) => h.id !== id)].slice(0, 300);
  state = { ...state, history };
  emit();
}

export function recentTracks(limit = 40) {
  return state.history
    .map((h) => trackById(h.id))
    .filter(Boolean)
    .slice(0, limit);
}

export function mostPlayed(limit = 40) {
  const counts = new Map();
  for (const entry of state.history) counts.set(entry.id, (counts.get(entry.id) || 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ track: trackById(id), count }))
    .filter((x) => x.track)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function createPlaylist(name = 'פלייליסט חדש', trackIds = []) {
  const playlist = { id: uid(), name, trackIds: [...trackIds], createdAt: Date.now(), cover: null };
  setState({ playlists: [...state.playlists, playlist] });
  toast(`נוצר פלייליסט "${name}"`, 'success');
  return playlist;
}

export function renamePlaylist(id, name) {
  setState({ playlists: state.playlists.map((p) => (p.id === id ? { ...p, name } : p)) });
}

export function deletePlaylist(id) {
  setState({ playlists: state.playlists.filter((p) => p.id !== id) });
  toast('הפלייליסט נמחק', 'info');
}

export function addToPlaylist(playlistId, ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  setState({
    playlists: state.playlists.map((p) =>
      p.id === playlistId
        ? { ...p, trackIds: [...p.trackIds, ...list.filter((id) => !p.trackIds.includes(id))] }
        : p,
    ),
  });
  toast(`נוספו ${list.length} שירים לפלייליסט`, 'success');
}

export function removeFromPlaylist(playlistId, id) {
  setState({
    playlists: state.playlists.map((p) =>
      p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((t) => t !== id) } : p,
    ),
  });
}

export function reorderPlaylist(playlistId, from, to) {
  setState({
    playlists: state.playlists.map((p) => {
      if (p.id !== playlistId) return p;
      const ids = [...p.trackIds];
      const [moved] = ids.splice(from, 1);
      if (moved === undefined) return p;
      ids.splice(Math.max(0, Math.min(ids.length, to)), 0, moved);
      return { ...p, trackIds: ids };
    }),
  });
}

/* ------------------------------------------------------------------ */
/* Search, sorting, appearance                                         */
/* ------------------------------------------------------------------ */

export function setQuery(query) {
  setState({ query });
}

export function setSort(key) {
  const sort =
    state.sort.key === key
      ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' };
  setState({ sort });
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  setState({ theme });
}

export function setAccent(accent) {
  document.documentElement.dataset.accent = accent;
  setState({ accent });
}

export function toggleSidebar() {
  setState({ sidebarCollapsed: !state.sidebarCollapsed });
}

export function setVisualizer(visualizer) {
  document.documentElement.dataset.visualizer = visualizer;
  setState({ visualizer });
}

export function toggleLyrics() {
  setState({ showLyrics: !state.showLyrics });
}

export function setCustomCover(id, dataUrl) {
  setState({ customCovers: { ...state.customCovers, [id]: dataUrl } });
}

/* ------------------------------------------------------------------ */
/* Equalizer                                                           */
/* ------------------------------------------------------------------ */

export function applyEq(patch = {}) {
  const next = { ...state, ...patch };
  engine.setEqGains(next.eqGains);
  engine.setEqEnabled(next.eqEnabled);
  engine.setPreamp(next.preamp);
  setState({
    eqGains: [...next.eqGains],
    eqEnabled: next.eqEnabled,
    preamp: next.preamp,
    eqPreset: next.eqPreset,
  });
}

export function setEqPreset(preset) {
  const gains = EQ_PRESETS[preset] || state.eqGains;
  applyEq({ eqGains: [...gains], eqPreset: preset });
}

export function setEqBand(index, value) {
  const eqGains = [...state.eqGains];
  eqGains[index] = value;
  applyEq({ eqGains, eqPreset: 'מותאם אישית' });
}

export function toggleEq() {
  applyEq({ eqEnabled: !state.eqEnabled });
}

export function setPreamp(value) {
  applyEq({ preamp: value });
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export function toast(message, type = 'info') {
  const id = uid();
  setState({ toasts: [...state.toasts, { id, message, type }] });
  setTimeout(() => setState({ toasts: state.toasts.filter((t) => t.id !== id) }), 3200);
}

/* ------------------------------------------------------------------ */
/* Drag & drop import                                                  */
/* ------------------------------------------------------------------ */

export async function handleDrop(event) {
  event.preventDefault();
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) return;
  if (isDesktop) {
    const paths = files.map((f) => pathForFile(f)).filter(Boolean);
    if (paths.length) await importPaths(paths);
    return;
  }
  await importBrowserFiles(files);
}

/* ------------------------------------------------------------------ */
/* Demo library                                                        */
/* ------------------------------------------------------------------ */

let demoLoading = false;

/** Load the built-in demo library (short instrumental loops rendered locally). */
export async function loadDemoLibrary() {
  if (demoLoading) return;
  demoLoading = true;
  try {
    const { buildDemoTracks } = await import('./demo.js');
    const demos = await buildDemoTracks();
    mergeTracks(demos);
    const hasPlaylist = state.playlists.some((p) => p.id === 'demo-playlist');
    state = {
      ...state,
      folders: state.folders.includes('demo') ? state.folders : [...state.folders, 'demo'],
      playlists: hasPlaylist
        ? state.playlists
        : [
            ...state.playlists,
            { id: 'demo-playlist', name: 'דמו – SHOSO', trackIds: demos.map((d) => d.id), createdAt: Date.now(), cover: null },
          ],
    };
    emit();
    toast('ספריית הדמו נטענה – 6 שירים', 'success');
  } catch (err) {
    console.error(err);
    toast('טעינת הדמו נכשלה', 'error');
  } finally {
    demoLoading = false;
  }
}

export { appInfo, isDesktop };
