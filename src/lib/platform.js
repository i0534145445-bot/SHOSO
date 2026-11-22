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

export const mediaUrl = (bookOrPath) => {
  const filePath = typeof bookOrPath === 'string' ? bookOrPath : bookOrPath.path;
  if (!bridge || /^(blob|data|https?):/i.test(filePath)) return filePath;
  return bridge.mediaUrl(filePath);
};

/* ---------------- file pickers ---------------- */

const pickWithInput = ({ directory = false, multiple = true } = {}) =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = '.epub,.pdf,.txt,.fb2,.html,.htm,.md,.mobi,.djvu';
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

const LS_STATE = 'shoso.books.state.v1';

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

export async function openExternal(url) {
  if (bridge) {
    try {
      return await bridge.openExternal(url);
    } catch {
      return false;
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export const onScanProgress = (cb) => (bridge ? bridge.onScanProgress(cb) : () => {});

/** A folder changed on disk – only the desktop build has watchers. */
export const onLibraryChanged = (cb) => (bridge?.onLibraryChanged ? bridge.onLibraryChanged(cb) : () => {});

/** Hand a renderer-drawn cover (a PDF's first page) to the main process. */
export const saveCoverData = async (dataUrl) => {
  if (!bridge?.saveCover) return null;
  try {
    return await bridge.saveCover(dataUrl);
  } catch {
    return null;
  }
};
export const setNativeTheme = (theme) => (bridge ? bridge.setTheme(theme) : null);
export const pathForFile = (file) => (bridge ? bridge.pathForFile(file) : null);

/* ---------------- reading book bytes ---------------- */

/** In browser mode we keep File handles in memory (object URLs die on reload). */
const fileHandles = new Map();

export function registerFileHandle(bookId, file) {
  fileHandles.set(bookId, file);
}

export function getFileHandle(bookId) {
  return fileHandles.get(bookId) || null;
}

/**
 * Read a book's bytes as ArrayBuffer.
 * Desktop: fetch via shoso-media:// protocol. Browser: File.arrayBuffer().
 */
export async function readBookBuffer(book) {
  if (!book) throw new Error('ספר לא נמצא');
  const handle = getFileHandle(book.id);
  if (handle) {
    return handle.arrayBuffer();
  }
  if (book._buffer) {
    return book._buffer;
  }
  if (bridge) {
    const url = bridge.mediaUrl(book.path);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`לא ניתן לקרוא את הקובץ (${res.status})`);
    return res.arrayBuffer();
  }
  // Browser fallback: book.path may already be a blob: URL
  const res = await fetch(book.path);
  if (!res.ok) throw new Error(`לא ניתן לקרוא את הקובץ (${res.status})`);
  return res.arrayBuffer();
}

/* ---------------- browser: turn File objects into books ---------------- */

const BOOK_RX = /\.(epub|pdf|txt|fb2|html|htm|md|mobi|djvu)$/i;

const splitName = (name) => {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const m = /^(.*?)\s+-\s+(.*)$/.exec(base);
  if (m) return { author: m[1].trim(), title: m[2].trim() };
  return { author: null, title: base };
};

const hashString = (str) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (((h1 ^ (h2 >>> 16)) >>> 0).toString(16) + (h2 >>> 0).toString(16)).slice(0, 16);
};

export async function booksFromFiles(files) {
  const bookFiles = files.filter((f) => BOOK_RX.test(f.name));
  const books = [];
  for (const file of bookFiles) {
    const url = URL.createObjectURL(file);
    const rel = file.webkitRelativePath || file.name;
    const folder = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : 'קבצים שהוספתי';
    const parsed = splitName(file.name);
    const ext = `.${(file.name.split('.').pop() || '').toLowerCase()}`;
    const id = hashString(`${file.name}:${file.size}:${file.lastModified}:${rel}`);
    registerFileHandle(id, file);
    books.push({
      id,
      path: url,
      dir: folder,
      fileName: file.name,
      title: parsed.title,
      author: parsed.author || 'מחבר לא ידוע',
      language: '',
      format: ext.slice(1).toUpperCase(),
      ext,
      size: file.size,
      mtime: file.lastModified,
      cover: null,
      pageCount: 0,
      chapters: 0,
      wordCount: 0,
      addedAt: Date.now(),
    });
  }
  return books;
}
