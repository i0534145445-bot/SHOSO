/**
 * Platform abstraction: Electron (Windows desktop) vs. plain browser (demo).
 * The UI code only talks to this module, never to `window.shoso` directly.
 */

const bridge = typeof window !== 'undefined' && window.shoso && window.shoso.isElectron ? window.shoso : null;

export const isDesktop = Boolean(bridge);
export const isWindows = isDesktop && typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent);

export const appInfo = {
  desktop: isDesktop,
  platform: isDesktop ? 'win32' : 'browser',
  version: '1.0.0',
  userData: '',
};

export async function initPlatform() {
  if (bridge) {
    try {
      const info = await bridge.info();
      Object.assign(appInfo, info, { desktop: true });
    } catch {
      /* ignore */
    }
  }
  return appInfo;
}

/* ---------------- media URLs ---------------- */

export const mediaUrl = (trackOrPath) => {
  const filePath = typeof trackOrPath === 'string' ? trackOrPath : trackOrPath.path;
  // Browser demo tracks are already blob:/data: URLs – pass them through untouched.
  if (!bridge || /^(blob|data|https?):/i.test(filePath)) return filePath;
  return bridge.mediaUrl(filePath);
};

/* ---------------- file pickers ---------------- */

const pickWithInput = ({ directory = false, multiple = true } = {}) =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = 'audio/*,.mp3,.flac,.m4a,.wav,.ogg,.opus,.aac,.wma,.aiff,.m4b';
    if (directory) {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    }
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      input.remove();
      resolve(files);
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve([]);
    });
    input.click();
  });

export async function pickFolders() {
  if (bridge) return { paths: await bridge.pickFolders(), files: [] };
  return { paths: [], files: await pickWithInput({ directory: true }) };
}

export async function pickFiles() {
  if (bridge) return { paths: await bridge.pickFiles(), files: [] };
  return { paths: [], files: await pickWithInput({ directory: false }) };
}

/* ---------------- persistence ---------------- */

const LS_STATE = 'shoso.state.v1';

export async function loadPersistedState() {
  if (bridge) {
    try {
      return await bridge.loadState();
    } catch {
      return null;
    }
  }
  try {
    const raw = localStorage.getItem(LS_STATE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function savePersistedState(state) {
  if (bridge) {
    try {
      await bridge.saveState(state);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    localStorage.setItem(LS_STATE, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export async function loadPersistedLibrary() {
  if (!bridge) return null; // browser libraries are session-only (object URLs)
  try {
    return await bridge.loadLibrary();
  } catch {
    return null;
  }
}

export async function savePersistedLibrary(library) {
  if (!bridge) return;
  try {
    await bridge.saveLibrary(library);
  } catch {
    /* ignore */
  }
}

export async function readLyrics(track) {
  if (bridge) {
    try {
      return await bridge.lyrics(track);
    } catch {
      return null;
    }
  }
  return track._lyrics || null;
}

export async function revealInExplorer(filePath) {
  if (bridge && filePath) {
    try {
      return await bridge.reveal(filePath);
    } catch {
      /* ignore */
    }
  }
  return false;
}

export const onScanProgress = (cb) => (bridge ? bridge.onScanProgress(cb) : () => {});
export const setNativeTheme = (theme) => (bridge ? bridge.setTheme(theme) : null);
export const pathForFile = (file) => (bridge ? bridge.pathForFile(file) : null);

/* ---------------- browser: turn File objects into tracks ---------------- */

const AUDIO_RX = /\.(mp3|m4a|m4b|aac|flac|wav|ogg|oga|opus|wma|webm|aiff|aif|mp4)$/i;

const splitName = (name) => {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const m = /^(.*?)\s+-\s+(.*)$/.exec(base);
  if (m) {
    // Common convention is "Artist - Title"; if the second part looks like a number, flip it.
    return { artist: m[1].trim(), title: m[2].trim() };
  }
  const num = /^(\d{1,3})[\s.\-]+(.*)$/.exec(base);
  if (num) return { artist: null, title: num[2].trim(), trackNo: parseInt(num[1], 10) };
  return { artist: null, title: base };
};

const probeDuration = (url) =>
  new Promise((resolve) => {
    const el = new Audio();
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      el.removeAttribute('src');
      el.load();
      resolve(value);
    };
    el.addEventListener('loadedmetadata', () => done(Number.isFinite(el.duration) ? el.duration : 0));
    el.addEventListener('error', () => done(0));
    setTimeout(() => done(Number.isFinite(el.duration) ? el.duration : 0), 4000);
    el.src = url;
    el.load();
  });

const hashString = (str) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (((h1 ^ (h2 >>> 16)) >>> 0).toString(16) + (h2 >>> 0).toString(16)).slice(0, 12);
};

export async function tracksFromFiles(files) {
  const audioFiles = files.filter((f) => AUDIO_RX.test(f.name));
  const tracks = [];
  for (const file of audioFiles) {
    const url = URL.createObjectURL(file);
    const rel = file.webkitRelativePath || file.name;
    const folder = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : 'קבצים שהוספתי';
    const parsed = splitName(file.name);
    const duration = await probeDuration(url);
    tracks.push({
      id: hashString(`${file.name}:${file.size}:${file.lastModified}:${rel}`),
      path: url,
      dir: folder,
      fileName: file.name,
      title: parsed.title,
      artist: parsed.artist || 'אמן לא ידוע',
      albumArtist: parsed.artist || '',
      album: folder.split('/').pop() || 'אלבום לא ידוע',
      genre: '',
      year: '',
      trackNo: parsed.trackNo || 0,
      discNo: 0,
      duration,
      bitrate: 0,
      codec: (file.name.split('.').pop() || '').toLowerCase(),
      sampleRate: 0,
      size: file.size,
      mtime: file.lastModified,
      picture: null,
      hasLyrics: false,
    });
  }
  return tracks;
}
