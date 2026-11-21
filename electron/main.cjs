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

const { app, BrowserWindow, ipcMain, protocol, dialog, shell, Menu, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const BOOK_EXT = new Set(['.epub', '.pdf', '.txt', '.fb2', '.html', '.htm', '.md', '.mobi', '.djvu']);
const COVER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const isDev = !app.isPackaged;
let mainWindow = null;
let JSZip = null;

const userData = () => app.getPath('userData');
const coversDir = () => path.join(userData(), 'covers');
const stateFile = () => path.join(userData(), 'state.json');
const libraryFile = () => path.join(userData(), 'library.json');

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
    // cover: manifest item with properties="cover-image" or id="cover"
    let coverHref = '';
    const manifestMatch = /<manifest[\s\S]*?<\/manifest>/i.exec(opfXml);
    const manifest = manifestMatch ? manifestMatch[0] : opfXml;
    const items = [...manifest.matchAll(/<item[^>]*>/gi)].map((m) => m[0]);
    for (const item of items) {
      const props = xmlAttr(item, 'item', 'properties');
      const id = xmlAttr(item, 'item', 'id');
      const href = xmlAttr(item, 'item', 'href');
      if (/cover-image/i.test(props) || /^cover$/i.test(id)) { coverHref = href; break; }
    }
    if (!coverHref) {
      for (const item of items) {
        const href = xmlAttr(item, 'item', 'href');
        const media = xmlAttr(item, 'item', 'media-type');
        if (/image\/(jpeg|png)/i.test(media) && /cover/i.test(href)) { coverHref = href; break; }
      }
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
        meta.cover = await saveCover(data, 'image/jpeg');
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

async function readBook(filePath) {
  const stat = await fsp.stat(filePath).catch(() => null);
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
  return book;
}

async function scanFolder(rootFolder, onProgress) {
  const files = [];
  const stat = await fsp.stat(rootFolder).catch(() => null);
  if (!stat) return [];
  if (stat.isFile()) {
    if (BOOK_EXT.has(path.extname(rootFolder).toLowerCase())) files.push(rootFolder);
  } else {
    await walk(rootFolder, files);
  }
  const books = [];
  let done = 0;
  for (const file of files) {
    try {
      books.push(await readBook(file));
    } catch {
      /* skip unreadable file */
    }
    done += 1;
    if (onProgress && (done % 5 === 0 || done === files.length)) {
      onProgress({ done, total: files.length, file: path.basename(file) });
    }
  }
  return books;
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    platform: process.platform,
    version: app.getVersion(),
    userData: userData(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    isPackaged: app.isPackaged,
  }));

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

  ipcMain.handle('library:scan', async (event, folders) => {
    const list = Array.isArray(folders) ? folders : [folders];
    const all = [];
    for (const folder of list) {
      const progress = (p) =>
        !event.sender.isDestroyed() && event.sender.send('library:progress', { folder, ...p });
      const books = await scanFolder(folder, progress);
      all.push(...books);
    }
    return all;
  });

  ipcMain.handle('book:refresh', async (_event, filePath) => readBook(filePath));

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
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

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const devUrl = process.env.SHOSO_DEV_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

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
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
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
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = { BOOK_EXT, readBook };
