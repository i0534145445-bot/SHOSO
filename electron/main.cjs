'use strict';

/**
 * SHOSO Music – Electron main process (Windows desktop shell).
 *
 * Responsibilities:
 *  - Create the Windows app window.
 *  - Scan local music folders and read audio metadata (ID3 / FLAC / M4A / OGG).
 *  - Stream local audio to the renderer through a Range-aware `shoso-media://` protocol.
 *  - Persist the library, playlists and settings inside %APPDATA%/SHOSO Music.
 */

const { app, BrowserWindow, ipcMain, protocol, dialog, shell, Menu, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pathToFileURL } = require('node:url');

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.oga', '.opus', '.wma', '.webm', '.aiff', '.aif', '.mp4', '.m4b', '.wv']);
const COVER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const isDev = !app.isPackaged;
let mainWindow = null;
let musicMetadata = null;

const userData = () => app.getPath('userData');
const coversDir = () => path.join(userData(), 'covers');
const stateFile = () => path.join(userData(), 'state.json');
const libraryFile = () => path.join(userData(), 'library.json');

async function getMetadataLib() {
  if (!musicMetadata) {
    // music-metadata is CommonJS here; guard against double-`default` wrapping.
    const mod = await import('music-metadata');
    musicMetadata = mod && typeof mod.parseFile === 'function' ? mod : mod.default;
  }
  return musicMetadata;
}

/* ------------------------------------------------------------------ */
/* Custom media protocol (byte-range aware, required for seeking)      */
/* ------------------------------------------------------------------ */

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'shoso-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true },
  },
]);

const MIME = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
  '.wma': 'audio/x-ms-wma',
  '.wv': 'audio/x-wavpack',
  '.mp4': 'audio/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
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
      // Blob/remote URLs are handled by the renderer itself; only local files here.
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
/* Library scanning                                                    */
/* ------------------------------------------------------------------ */

const coverCache = new Map();

async function saveCover(data, mime) {
  const hash = crypto.createHash('sha1').update(data).digest('hex');
  await fsp.mkdir(coversDir(), { recursive: true });
  const ext = mime && mime.includes('png') ? '.png' : mime && mime.includes('webp') ? '.webp' : '.jpg';
  const file = path.join(coversDir(), hash + ext);
  if (!fs.existsSync(file)) await fsp.writeFile(file, data);
  return `shoso-media://cover/?p=${encodeURIComponent(file)}`;
}

async function folderCover(dir) {
  if (coverCache.has(dir)) return coverCache.get(dir);
  let result = null;
  try {
    const entries = await fsp.readdir(dir);
    const preferred = ['cover', 'folder', 'front', 'album', 'artwork'];
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

async function readLrcFor(audioPath) {
  const base = audioPath.replace(/\.[^.\\/]+$/, '');
  for (const candidate of [`${base}.lrc`, `${base}.LRC`, path.join(path.dirname(audioPath), 'lyrics.lrc')]) {
    try {
      const text = await fsp.readFile(candidate, 'utf8');
      if (text && text.trim()) return text;
    } catch {
      /* next */
    }
  }
  return null;
}

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
    } else if (AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

async function readTrack(filePath, { withCover = true } = {}) {
  const stat = await fsp.stat(filePath).catch(() => null);
  const id = crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 16);
  const fallbackTitle = path.basename(filePath).replace(/\.[^.]+$/, '');
  const track = {
    id,
    path: filePath,
    dir: path.dirname(filePath),
    fileName: path.basename(filePath),
    title: fallbackTitle,
    artist: 'אמן לא ידוע',
    albumArtist: '',
    album: 'אלבום לא ידוע',
    genre: '',
    year: '',
    trackNo: 0,
    discNo: 0,
    duration: 0,
    bitrate: 0,
    codec: '',
    sampleRate: 0,
    size: stat ? stat.size : 0,
    mtime: stat ? stat.mtimeMs : 0,
    picture: null,
    hasLyrics: false,
  };

  try {
    const lib = await getMetadataLib();
    const meta = await lib.parseFile(filePath, { duration: true, skipCovers: !withCover });
    const c = meta.common || {};
    const f = meta.format || {};
    track.title = c.title || track.title;
    track.artist = c.artist || (c.artists && c.artists[0]) || track.artist;
    track.albumArtist = c.albumartist || '';
    track.album = c.album || track.album;
    track.genre = Array.isArray(c.genre) ? c.genre.join(', ') : c.genre || '';
    track.year = c.year ? String(c.year) : '';
    track.trackNo = c.track && c.track.no ? c.track.no : 0;
    track.discNo = c.disk && c.disk.no ? c.disk.no : 0;
    track.duration = f.duration || 0;
    track.bitrate = f.bitrate || 0;
    track.codec = f.codec || (f.container || '');
    track.sampleRate = f.sampleRate || 0;
    if (c.lyrics && String(c.lyrics).trim()) track.hasLyrics = true;
    if (withCover && c.picture && c.picture[0] && c.picture[0].data) {
      try {
        track.picture = await saveCover(Buffer.from(c.picture[0].data), c.picture[0].format);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* keep filename fallbacks */
  }

  if (!track.picture) track.picture = await folderCover(track.dir);
  if (!track.hasLyrics) track.hasLyrics = Boolean(await readLrcFor(filePath));
  return track;
}

async function scanFolder(rootFolder, onProgress) {
  const files = [];
  await walk(rootFolder, files);
  const tracks = [];
  let done = 0;
  for (const file of files) {
    try {
      tracks.push(await readTrack(file));
    } catch {
      /* skip unreadable file */
    }
    done += 1;
    if (onProgress && (done % 5 === 0 || done === files.length)) {
      onProgress({ done, total: files.length, file: path.basename(file) });
    }
  }
  return tracks;
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
      title: 'בחר תיקיות מוזיקה',
      properties: ['openDirectory', 'multiSelections'],
      buttonLabel: 'הוסף לספרייה',
    });
    return res.canceled ? [] : res.filePaths;
  });

  ipcMain.handle('dialog:pickFiles', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'בחר קבצי מוזיקה',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'שמע', extensions: [...AUDIO_EXT].map((e) => e.slice(1)) }],
      buttonLabel: 'הוסף לספרייה',
    });
    return res.canceled ? [] : res.filePaths;
  });

  ipcMain.handle('library:scan', async (event, folders) => {
    const list = Array.isArray(folders) ? folders : [folders];
    const all = [];
    for (const folder of list) {
      const stat = await fsp.stat(folder).catch(() => null);
      if (!stat) continue;
      if (stat.isFile()) {
        all.push(await readTrack(folder));
        continue;
      }
      const progress = (p) =>
        !event.sender.isDestroyed() && event.sender.send('library:progress', { folder, ...p });
      const tracks = await scanFolder(folder, progress);
      // Only attach files that belong to this folder root
      all.push(...tracks);
    }
    return all;
  });

  ipcMain.handle('track:refresh', async (_event, filePath) => readTrack(filePath));

  ipcMain.handle('track:lyrics', async (_event, track) => {
    if (!track) return null;
    if (track.path) {
      const lrc = await readLrcFor(track.path);
      if (lrc) return { type: 'lrc', text: lrc };
    }
    try {
      const lib = await getMetadataLib();
      if (track.path) {
        const meta = await lib.parseFile(track.path, { skipCovers: true });
        if (meta.common.lyrics && meta.common.lyrics.length) {
          return { type: 'unsynced', text: meta.common.lyrics.join('\n') };
        }
      }
    } catch {
      /* ignore */
    }
    return null;
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
    title: 'SHOSO Music',
    autoHideMenuBar: true,
    // The icon exists in dev; packaged builds take the icon from the .exe itself.
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

  // Windows: keep media keys working while the window is unfocused.
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.setAppUserModelId('com.shoso.music');

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

module.exports = { AUDIO_EXT, readTrack };
