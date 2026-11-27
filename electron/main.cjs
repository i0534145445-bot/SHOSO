'use strict';

/**
 * SHOSO Books – Electron main process (Windows desktop shell).
 *
 * Responsibilities:
 *  - Create the Windows app window.
 *  - Scan local book folders and read book metadata (EPUB OPF / FB2 XML / PDF info / TXT).
 *  - Stream local book files to the renderer through a Range-aware `shoso-media://` protocol.
 *  - Persist the library and reading state inside %APPDATA%/SHOSO Books.
 */

const { app, BrowserWindow, ipcMain, protocol, dialog, shell, Menu, nativeTheme, screen, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const BOOK_EXT = new Set(['.epub', '.pdf', '.txt', '.fb2', '.html', '.htm', '.md', '.mobi', '.djvu']);
const COVER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/**
 * Windows hands a double-clicked ("Open with") document to the app as a plain
 * command-line argument. Everything here exists so the book the user picked
 * lands in the library instead of being ignored.
 */
const OPENABLE_EXT = new Set(['.epub', '.pdf', '.fb2', '.mobi', '.azw3', '.txt', '.html', '.htm', '.md']);

function filesFromArgv(argv) {
  const out = [];
  for (const arg of (argv || []).slice(1)) {
    if (typeof arg !== 'string' || arg.startsWith('-')) continue;
    if (!OPENABLE_EXT.has(path.extname(arg).toLowerCase())) continue;
    try {
      if (fs.statSync(arg).isFile()) out.push(arg);
    } catch { /* a stale shortcut target */ }
  }
  return out;
}

/**
 * A portable copy keeps its library beside the .exe instead of writing into
 * %APPDATA%, so it can sit on a USB stick without sharing (or overwriting) the
 * library of an installed copy. Must run before anything reads userData.
 */
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'SHOSO Books Data'));
}

const isDev = !app.isPackaged;
let mainWindow = null;
let JSZip = null;

const userData = () => app.getPath('userData');
const coversDir = () => path.join(userData(), 'covers');
const stateFile = () => path.join(userData(), 'state.json');
const libraryFile = () => path.join(userData(), 'library.json');
const windowStateFile = () => path.join(userData(), 'window.json');
const updateFile = () => path.join(userData(), 'update.json');

/* ---------------- update checks ---------------- */

/**
 * The app never needs the network: the library, the books and the settings are
 * all local. This is the only outbound call – it asks GitHub for the newest
 * release tag so the app can say "a newer version exists". Offline, it fails
 * quietly and the app keeps working.
 */
const UPDATE_CHECK_INTERVAL = 12 * 60 * 60 * 1000; // twice a day at most
const RELEASES_API = 'https://api.github.com/repos/i0534145445-bot/SHOSO/releases/latest';

function readUpdateCache() {
  try {
    return JSON.parse(fs.readFileSync(updateFile(), 'utf8'));
  } catch {
    return null;
  }
}

function writeUpdateCache(data) {
  try {
    fs.mkdirSync(userData(), { recursive: true });
    fs.writeFileSync(updateFile(), JSON.stringify(data), 'utf8');
  } catch { /* a read-only folder must not break the app */ }
}

async function fetchLatestRelease() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await net.fetch(RELEASES_API, {
      signal: controller.signal,
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const assets = Array.isArray(json.assets)
      ? json.assets.map((a) => ({ name: String(a.name || ''), url: String(a.browser_download_url || ''), size: a.size || 0 }))
      : [];
    return {
      ok: true,
      tag: String(json.tag_name || ''),
      name: String(json.name || ''),
      notes: String(json.body || '').slice(0, 1500),
      page: String(json.html_url || ''),
      publishedAt: String(json.published_at || ''),
      assets,
    };
  } finally {
    clearTimeout(timer);
  }
}

const DEFAULT_WINDOW = { width: 1280, height: 820 };

/** Where the window was last time – the app opens the way it was left. */
function readWindowState() {
  try {
    const raw = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
    if (!raw || typeof raw !== 'object') return null;
    const clamp = (value, fallback) => (Number.isFinite(value) ? Math.round(value) : fallback);
    return {
      x: Number.isFinite(raw.x) ? Math.round(raw.x) : undefined,
      y: Number.isFinite(raw.y) ? Math.round(raw.y) : undefined,
      width: Math.max(940, clamp(raw.width, DEFAULT_WINDOW.width)),
      height: Math.max(620, clamp(raw.height, DEFAULT_WINDOW.height)),
      maximized: Boolean(raw.maximized),
    };
  } catch {
    return null;
  }
}

/** A window saved on a monitor that is gone must not open off-screen. */
function onScreen(state) {
  if (!state || state.x === undefined || state.y === undefined) return state;
  const rect = { x: state.x, y: state.y, width: state.width, height: state.height };
  const area = screen.getDisplayMatching(rect).workArea;
  const visible = rect.x < area.x + area.width - 80
    && rect.x + rect.width > area.x + 80
    && rect.y < area.y + area.height - 60
    && rect.y + rect.height > area.y;
  return visible ? state : { ...state, x: undefined, y: undefined };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getNormalBounds();
    fs.mkdirSync(userData(), { recursive: true });
    fs.writeFileSync(windowStateFile(), JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }));
  } catch {
    /* the window position is a convenience, never a fatal error */
  }
}

async function getZip() {
  if (!JSZip) {
    const mod = await import('jszip');
    JSZip = mod && mod.default ? mod.default : mod;
  }
  return JSZip;
}

/* ------------------------------------------------------------------ */
/* Custom media protocol (byte-range aware, required for PDF seeking)  */
/* ------------------------------------------------------------------ */

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'shoso-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true },
  },
]);

const MIME = {
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.fb2': 'application/xml; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mobi': 'application/x-mobipocket-ebook',
  '.djvu': 'image/x-djvu',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.css': 'text/css',
  '.xml': 'application/xml',
  '.opf': 'application/oebps-package+xml',
  '.ncx': 'application/x-dtbncx+xml',
  '.svg': 'image/svg+xml',
  '.xhtml': 'application/xhtml+xml',
};

function mediaStream(filePath, request) {
  return fsp.stat(filePath).then((stat) => {
    const size = stat.size;
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const range = request.headers.get('range');

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : size - 1;
        if (Number.isNaN(start)) start = 0;
        if (Number.isNaN(end) || end >= size) end = size - 1;
        if (start > end) start = 0;
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(stream), {
          status: 206,
          headers: {
            'Content-Type': type,
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    const stream = fs.createReadStream(filePath);
    return new Response(Readable.toWeb(stream), {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      },
    });
  });
}

function registerMediaProtocol() {
  protocol.handle('shoso-media', async (request) => {
    try {
      const url = new URL(request.url);
      let filePath = url.searchParams.get('p');
      if (!filePath) return new Response('missing path', { status: 400 });
      if (/^(https?|blob|data):/i.test(filePath)) {
        return new Response('unsupported path', { status: 415 });
      }
      return await mediaStream(filePath, request);
    } catch (err) {
      return new Response(`media error: ${err.message}`, { status: 404 });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Metadata helpers                                                    */
/* ------------------------------------------------------------------ */

function xmlText(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = re.exec(xml || '');
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

function xmlAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}\\s*=\\s*"([^"]+)"`, 'i');
  const m = re.exec(xml || '');
  return m ? m[1] : '';
}

async function saveCover(data, mime) {
  const hash = crypto.createHash('sha1').update(data).digest('hex');
  await fsp.mkdir(coversDir(), { recursive: true });
  const ext = mime && mime.includes('png') ? '.png' : mime && mime.includes('webp') ? '.webp' : mime && mime.includes('gif') ? '.gif' : '.jpg';
  const file = path.join(coversDir(), hash + ext);
  if (!fs.existsSync(file)) await fsp.writeFile(file, data);
  return `shoso-media://cover/?p=${encodeURIComponent(file)}`;
}

const coverCache = new Map();

async function folderCover(dir) {
  if (coverCache.has(dir)) return coverCache.get(dir);
  let result = null;
  try {
    const entries = await fsp.readdir(dir);
    const preferred = ['cover', 'folder', 'front', 'book', 'artwork'];
    const images = entries.filter((f) => COVER_EXT.has(path.extname(f).toLowerCase()));
    images.sort((a, b) => {
      const ai = preferred.findIndex((p) => a.toLowerCase().startsWith(p));
      const bi = preferred.findIndex((p) => b.toLowerCase().startsWith(p));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    if (images.length) {
      result = `shoso-media://cover/?p=${encodeURIComponent(path.join(dir, images[0]))}`;
    }
  } catch {
    /* ignore */
  }
  coverCache.set(dir, result);
  return result;
}

async function readEpubMeta(filePath) {
  const meta = { title: '', author: '', language: '', cover: null, pageCount: 0, chapters: 0 };
  try {
    const Zip = await getZip();
    const buf = await fsp.readFile(filePath);
    const zip = await Zip.loadAsync(buf);
    // container.xml -> OPF
    let opfPath = null;
    const container = zip.file('META-INF/container.xml');
    if (container) {
      const xml = await container.async('string');
      const m = /full-path="([^"]+)"/.exec(xml);
      if (m) opfPath = m[1];
    }
    if (!opfPath) {
      const opf = Object.keys(zip.files).find((n) => n.endsWith('.opf'));
      if (opf) opfPath = opf;
    }
    if (!opfPath || !zip.file(opfPath)) return meta;
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const opfXml = await zip.file(opfPath).async('string');
    meta.title = xmlText(opfXml, 'dc:title') || xmlText(opfXml, 'title');
    meta.author = xmlText(opfXml, 'dc:creator') || xmlText(opfXml, 'creator');
    meta.language = xmlText(opfXml, 'dc:language') || xmlText(opfXml, 'language');
    // Cover, in the order EPUB itself defines it:
    //   1. EPUB3 – manifest item with properties="cover-image"
    //   2. EPUB2 – <meta name="cover" content="ITEM-ID"/> (very common, and the
    //      reason books used to stay cover-less forever)
    //   3. <guide><reference type="cover" href="…"/>
    //   4. an image whose file name or item id says "cover"
    const manifestMatch = /<manifest[\s\S]*?<\/manifest>/i.exec(opfXml);
    const manifest = manifestMatch ? manifestMatch[0] : opfXml;
    const items = [...manifest.matchAll(/<item[^>]*>/gi)].map((m) => m[0]);
    const attr = (item, name) => xmlAttr(item, 'item', name);
    let coverHref = '';
    const epub3 = items.find((i) => /cover-image/i.test(attr(i, 'properties')));
    if (epub3) coverHref = attr(epub3, 'href');
    if (!coverHref) {
      const metaCover = /<meta[^>]*name\s*=\s*["']cover["'][^>]*>/i.exec(opfXml);
      const metaId = metaCover ? xmlAttr(metaCover[0], 'meta', 'content') : '';
      const match = metaId ? items.find((i) => attr(i, 'id') === metaId) : null;
      if (match) coverHref = attr(match, 'href');
    }
    if (!coverHref) {
      const guide = /<guide[\s\S]*?<\/guide>/i.exec(opfXml);
      if (guide) {
        const ref = [...guide[0].matchAll(/<reference[^>]*>/gi)]
          .map((m) => m[0])
          .find((r) => /cover/i.test(xmlAttr(r, 'reference', 'type')));
        if (ref) coverHref = xmlAttr(ref, 'reference', 'href');
      }
    }
    if (!coverHref) {
      const byName = items.find((i) => /image\//i.test(attr(i, 'media-type'))
        && /cover|front|titlepage|artwork/i.test(`${attr(i, 'href')} ${attr(i, 'id')}`));
      if (byName) coverHref = attr(byName, 'href');
    }
    // spine count = chapters
    const spineMatch = /<spine[\s\S]*?<\/spine>/i.exec(opfXml);
    if (spineMatch) meta.chapters = (spineMatch[0].match(/<itemref/gi) || []).length;
    if (coverHref) {
      const coverPath = opfDir + decodeURIComponent(coverHref);
      const coverFile = zip.file(coverPath);
      if (coverFile) {
        const data = await coverFile.async('nodebuffer');
        meta.cover = await saveCover(data, coverHref.endsWith('.png') ? 'image/png' : 'image/jpeg');
      }
    }
  } catch {
    /* keep fallbacks */
  }
  return meta;
}

async function readFb2Meta(filePath) {
  const meta = { title: '', author: '', language: '', cover: null, chapters: 0 };
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    const head = text.slice(0, 200000);
    meta.title = xmlText(head, 'book-title') || xmlText(head, 'title');
    const first = xmlText(head, 'first-name');
    const last = xmlText(head, 'last-name');
    meta.author = [first, last].filter(Boolean).join(' ').trim();
    meta.language = xmlText(head, 'lang');
    meta.chapters = (text.match(/<section[\s>]/gi) || []).length;
    // cover: <coverpage><image xlink:href="#id"/></coverpage> + <binary id=".." content-type="..">base64</binary>
    const coverMatch = /<coverpage[\s\S]*?<image[^>]*xlink:href="#([^"]+)"/i.exec(head) || /<coverpage[\s\S]*?<image[^>]*href="#([^"]+)"/i.exec(head);
    if (coverMatch) {
      const id = coverMatch[1];
      const binRe = new RegExp(`<binary[^>]*id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</binary>`, 'i');
      const bin = binRe.exec(text);
      if (bin) {
        const data = Buffer.from(bin[1].replace(/\s/g, ''), 'base64');
        const type = /<binary[^>]*content-type\s*=\s*["']([^"']+)["']/i.exec(text);
        meta.cover = await saveCover(data, type ? type[1] : 'image/jpeg');
      }
    }
  } catch {
    /* ignore */
  }
  return meta;
}

async function readPdfMeta(filePath) {
  const meta = { title: '', author: '', language: '', cover: null, pageCount: 0, chapters: 0 };
  try {
    // Lightweight PDF info extraction without full render: parse /Title, /Author, /Count
    const buf = await fsp.readFile(filePath);
    const head = buf.slice(0, 200000).toString('latin1');
    const get = (key) => {
      const m = new RegExp(`/${key}\\s*\\(([^)]*)\\)`).exec(head);
      return m ? m[1].replace(/\\([()\\])/g, '$1') : '';
    };
    meta.title = get('Title');
    meta.author = get('Author');
    const count = /\/Count\s+(\d+)/.exec(head);
    if (count) meta.pageCount = parseInt(count[1], 10) || 0;
  } catch {
    /* ignore */
  }
  return meta;
}

async function readTxtMeta(filePath) {
  const meta = { title: '', author: '', language: '', cover: null, pageCount: 0, chapters: 0, wordCount: 0 };
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    meta.wordCount = (text.match(/\S+/g) || []).length;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length) {
      // First non-empty line is often the title.
      meta.title = lines[0].slice(0, 120);
      if (lines[1] && lines[1].length < 80) meta.author = lines[1].slice(0, 80);
    }
    meta.chapters = (text.match(/(^|\n)\s*(פרק|פרק|Chapter|CHAPTER|קפיטל|שער)\s+\S+/gi) || []).length;
  } catch {
    /* ignore */
  }
  return meta;
}

/* ------------------------------------------------------------------ */
/* Library scanning                                                    */
/* ------------------------------------------------------------------ */

async function walk(dir, out, depth = 0) {
  if (depth > 12) return;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out, depth + 1);
    } else if (BOOK_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

async function readBook(filePath, statGiven) {
  const stat = statGiven !== undefined ? statGiven : await fsp.stat(filePath).catch(() => null);
  const id = crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 16);
  const ext = path.extname(filePath).toLowerCase();
  const format = ext.slice(1).toUpperCase();
  const fallbackTitle = path.basename(filePath).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const book = {
    id,
    path: filePath,
    dir: path.dirname(filePath),
    fileName: path.basename(filePath),
    title: fallbackTitle,
    author: 'מחבר לא ידוע',
    language: '',
    format,
    ext,
    size: stat ? stat.size : 0,
    mtime: stat ? stat.mtimeMs : 0,
    cover: null,
    pageCount: 0,
    chapters: 0,
    wordCount: 0,
    addedAt: stat ? stat.mtimeMs : Date.now(),
  };

  try {
    let meta = null;
    if (ext === '.epub') meta = await readEpubMeta(filePath);
    else if (ext === '.fb2') meta = await readFb2Meta(filePath);
    else if (ext === '.pdf') meta = await readPdfMeta(filePath);
    else if (ext === '.txt' || ext === '.md') meta = await readTxtMeta(filePath);
    if (meta) {
      if (meta.title) book.title = meta.title;
      if (meta.author) book.author = meta.author;
      if (meta.language) book.language = meta.language;
      if (meta.cover) book.cover = meta.cover;
      if (meta.pageCount) book.pageCount = meta.pageCount;
      if (meta.chapters) book.chapters = meta.chapters;
      if (meta.wordCount) book.wordCount = meta.wordCount;
    }
  } catch {
    /* keep filename fallbacks */
  }

  if (!book.cover) book.cover = await folderCover(book.dir);
  // The scan owns covers: a book is only skipped on the next scan when the
  // cover question has actually been answered for it.
  book.coverChecked = true;
  return book;
}

/** Runs `fn` over `items` with a bounded number of workers. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

const SCAN_WORKERS = 6;

/* ------------------------------------------------------------------ */
/* Folder watching                                                     */
/* ------------------------------------------------------------------ */

/**
 * Adding a book to a folder used to do nothing until the folder was added
 * again. Each scanned folder is now watched (recursively on macOS/Windows) and
 * a change only asks the renderer for a fresh scan – the renderer stays the one
 * that decides what enters the library.
 */
const watchers = new Map();
const watchTimers = new Map();

function watchFolders(folders) {
  for (const folder of folders) {
    if (watchers.has(folder)) continue;
    try {
      const watcher = fs.watch(folder, { recursive: true, persistent: false }, () => {
        clearTimeout(watchTimers.get(folder));
        watchTimers.set(folder, setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:changed', folder);
        }, 1500));
      });
      watcher.on('error', () => {
        watchers.delete(folder);
        try { watcher.close(); } catch { /* already gone */ }
      });
      watchers.set(folder, watcher);
    } catch {
      /* recursive watching is not available everywhere – the manual rescan
         and the start-up scan still keep the library in step */
    }
  }
  for (const [folder, watcher] of watchers) {
    if (folders.includes(folder)) continue;
    try { watcher.close(); } catch { /* ignore */ }
    watchers.delete(folder);
  }
}

function closeWatchers() {
  for (const watcher of watchers.values()) {
    try { watcher.close(); } catch { /* ignore */ }
  }
  watchers.clear();
  for (const timer of watchTimers.values()) clearTimeout(timer);
  watchTimers.clear();
}

async function scanFolder(rootFolder, onProgress, known) {
  const files = [];
  const stat = await fsp.stat(rootFolder).catch(() => null);
  if (!stat) return [];
  if (stat.isFile()) {
    if (BOOK_EXT.has(path.extname(rootFolder).toLowerCase())) files.push(rootFolder);
  } else {
    await walk(rootFolder, files);
  }

  let done = 0;
  const books = await mapLimit(files, SCAN_WORKERS, async (file) => {
    let book = null;
    try {
      const st = await fsp.stat(file).catch(() => null);
      const before = known && known.get(file);
      // Unchanged since the last scan? Keep the entry we already have (title,
      // author, cover) instead of re-parsing the file.
      if (st && before && before.size === st.size && before.mtime === st.mtimeMs && before.coverChecked) {
        book = before;
      } else {
        book = await readBook(file, st);
      }
    } catch {
      book = null;
    }
    done += 1;
    if (onProgress && (done % 5 === 0 || done === files.length)) {
      onProgress({ done, total: files.length, file: path.basename(file) });
    }
    return book;
  });
  return books.filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    platform: process.platform,
    version: app.getVersion(),
    userData: userData(),
    exePath: process.execPath,
    portable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    isPackaged: app.isPackaged,
  }));

  ipcMain.handle('shell:openDataFolder', async () => {
    fs.mkdirSync(userData(), { recursive: true });
    return shell.openPath(userData());
  });

  ipcMain.handle('dialog:pickFolders', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'בחר תיקיות ספרים',
      properties: ['openDirectory', 'multiSelections'],
      buttonLabel: 'הוסף לספרייה',
    });
    return res.canceled ? [] : res.filePaths;
  });

  ipcMain.handle('dialog:pickFiles', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'בחר קבצי ספרים',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'ספרים', extensions: [...BOOK_EXT].map((e) => e.slice(1)) }],
      buttonLabel: 'הוסף לספרייה',
    });
    return res.canceled ? [] : res.filePaths;
  });

  /**
   * The one owner of the library: every scan – the first import, the rescan on
   * start-up, the one a folder watcher triggers – comes through here, so a
   * book's metadata and cover have exactly one source.
   * Returns the books plus the folders that were actually readable; the
   * renderer only removes books from folders that answered, so an unplugged
   * drive never wipes a library.
   */
  ipcMain.handle('library:scan', async (event, payload) => {
    // Accepts the legacy shape (array of folders) and the incremental one
    // ({ folders, known }) so the renderer can skip unchanged files.
    const folders = Array.isArray(payload) ? payload : (payload && payload.folders) || [];
    const knownList = Array.isArray(payload && payload.known) ? payload.known : [];
    const known = new Map(knownList.map((b) => [b.path, b]));

    const all = [];
    const scanned = [];
    for (const folder of folders) {
      const exists = await fsp.stat(folder).catch(() => null);
      const progress = (p) =>
        !event.sender.isDestroyed() && event.sender.send('library:progress', { folder, ...p });
      const books = await scanFolder(folder, progress, known);
      all.push(...books);
      if (exists) scanned.push(folder);
    }
    watchFolders(scanned);
    return { books: all, folders: scanned };
  });

  /**
   * A cover the renderer had to produce itself (a PDF's first page, which only
   * pdf.js can draw) is written next to the others and comes back as a stable
   * shoso-media URL, so it survives restarts like every scanned cover.
   */
  ipcMain.handle('cover:save', async (_event, payload) => {
    const dataUrl = payload && payload.dataUrl;
    if (typeof dataUrl !== 'string') return null;
    const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i.exec(dataUrl);
    if (!m) return null;
    try {
      const data = Buffer.from(m[2], 'base64');
      if (data.length > 12 * 1024 * 1024) return null;
      return await saveCover(data, `image/${m[1].toLowerCase()}`);
    } catch {
      return null;
    }
  });

  ipcMain.handle('book:refresh', async (_event, filePath) => readBook(filePath));

  /**
   * Windows 10/11 never lets an app silently become the default for a format –
   * only the user can do that. So the honest button is the page where they do
   * it, with the formats listed for them.
   */
  ipcMain.handle('update:check', async (_event, options) => {
    const force = Boolean(options && options.force);
    const cache = readUpdateCache();
    const fresh = cache && cache.ok && Date.now() - (cache.checkedAt || 0) < UPDATE_CHECK_INTERVAL;
    if (!force && fresh) return { ...cache, cached: true };
    try {
      const release = await fetchLatestRelease();
      const result = { ...release, checkedAt: Date.now(), current: app.getVersion(), cached: false };
      writeUpdateCache(result);
      return result;
    } catch (err) {
      // Offline is a normal state, not an error: nothing is written to the
      // cache, so the next launch tries again.
      return {
        ok: false,
        offline: true,
        error: String((err && err.message) || err),
        checkedAt: 0,
        current: app.getVersion(),
      };
    }
  });

  ipcMain.handle('shell:openUpdate', async (_event, url) => {
    const target = typeof url === 'string' ? url : '';
    if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com)\//.test(target)) return false;
    await shell.openExternal(target);
    return true;
  });

  ipcMain.handle('shell:defaultApps', async () => {
    if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:defaultapps');
      return true;
    }
    return false;
  });


  ipcMain.handle('state:load', async () => {
    try {
      return JSON.parse(await fsp.readFile(stateFile(), 'utf8'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('state:save', async (_event, state) => {
    await fsp.mkdir(userData(), { recursive: true });
    const tmp = `${stateFile()}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(state));
    await fsp.rename(tmp, stateFile());
    return true;
  });

  ipcMain.handle('library:save', async (_event, library) => {
    await fsp.mkdir(userData(), { recursive: true });
    const tmp = `${libraryFile()}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(library));
    await fsp.rename(tmp, libraryFile());
    return true;
  });

  ipcMain.handle('library:load', async () => {
    try {
      return JSON.parse(await fsp.readFile(libraryFile(), 'utf8'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('shell:reveal', async (_event, filePath) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    if (/^https?:\/\//i.test(url)) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('window:toggleFullscreen', () => {
    if (!mainWindow) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });

  ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow && mainWindow.close());

  ipcMain.handle('theme:set', (_event, theme) => {
    nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark';
    return nativeTheme.shouldUseDarkColors;
  });
}

/* ------------------------------------------------------------------ */
/* Window                                                             */
/* ------------------------------------------------------------------ */

const resolveIcon = () => {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build', 'icon.ico'),
  ];
  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
};

let pendingOpenFiles = [];

/** Send document paths to the renderer once it can receive them. */
function deliverOpenFiles(paths) {
  if (!paths || !paths.length) return;
  pendingOpenFiles.push(...paths);
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isLoading()) return;
  const batch = pendingOpenFiles.splice(0, pendingOpenFiles.length);
  mainWindow.webContents.send('open-files', batch);
}

function createWindow() {
  const saved = onScreen(readWindowState());
  mainWindow = new BrowserWindow({
    width: saved?.width || DEFAULT_WINDOW.width,
    height: saved?.height || DEFAULT_WINDOW.height,
    ...(saved && saved.x !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: '#0c0f14',
    title: 'SHOSO Books',
    autoHideMenuBar: true,
    icon: resolveIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (saved?.maximized) mainWindow.maximize();
    mainWindow.show();
  });

  // Remember the window as the reader leaves it (debounced – resize fires a lot).
  let windowTimer = null;
  const remember = () => {
    clearTimeout(windowTimer);
    windowTimer = setTimeout(saveWindowState, 400);
  };
  mainWindow.on('resize', remember);
  mainWindow.on('move', remember);
  mainWindow.on('maximize', remember);
  mainWindow.on('unmaximize', remember);
  mainWindow.on('close', () => {
    clearTimeout(windowTimer);
    saveWindowState();
  });

  const devUrl = process.env.SHOSO_DEV_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // A queued "open with" document waits for the page to be ready.
  mainWindow.webContents.on('did-finish-load', () => {
    if (!pendingOpenFiles.length) return;
    const batch = pendingOpenFiles.splice(0, pendingOpenFiles.length);
    mainWindow.webContents.send('open-files', batch);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.setAppUserModelId('com.shoso.books');

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    deliverOpenFiles(filesFromArgv(argv));
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';
    registerMediaProtocol();
    registerIpc();
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'קובץ',
          submenu: [
            { role: 'quit', label: 'יציאה' },
          ],
        },
        {
          label: 'תצוגה',
          submenu: [
            { role: 'reload', label: 'רענון' },
            { role: 'toggleDevTools', label: 'כלי מפתחים' },
            { type: 'separator' },
            { role: 'togglefullscreen', label: 'מסך מלא' },
          ],
        },
      ]),
    );
    createWindow();
    // Books opened from Explorer before the window finished loading are queued.
    deliverOpenFiles(filesFromArgv(process.argv));
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', closeWatchers);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = { BOOK_EXT, readBook };
