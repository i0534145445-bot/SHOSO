'use strict';

/**
 * Preload bridge. Exposes a tiny, typed `window.shoso` API to the renderer.
 * The renderer also works in a plain browser (demo mode) when `window.shoso`
 * is undefined – see src/lib/platform.js.
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel, cb) => {
  const handler = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('shoso', {
  isElectron: true,
  info: () => ipcRenderer.invoke('app:info'),
  pickFolders: () => ipcRenderer.invoke('dialog:pickFolders'),
  pickFiles: () => ipcRenderer.invoke('dialog:pickFiles'),
  scan: (folders, known) => ipcRenderer.invoke('library:scan', { folders, known }),
  // A folder changed on disk – the renderer decides what to do about it.
  onLibraryChanged: (cb) => on('library:changed', cb),
  // Covers the renderer had to draw itself (PDF page 1) are stored like the rest.
  saveCover: (dataUrl) => ipcRenderer.invoke('cover:save', { dataUrl }),
  onScanProgress: (cb) => on('library:progress', cb),
  refreshBook: (filePath) => ipcRenderer.invoke('book:refresh', filePath),
  // A book the user double-clicked (Windows "Open with").

  onOpenFiles: (cb) => on('open-files', cb),
  // Windows only lets the user choose a default app – this opens that page.
  openDefaultApps: () => ipcRenderer.invoke('shell:defaultApps'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  saveLibrary: (library) => ipcRenderer.invoke('library:save', library),
  reveal: (filePath) => ipcRenderer.invoke('shell:reveal', filePath),
  openDataFolder: () => ipcRenderer.invoke('shell:openDataFolder'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
  // Absolute path of a dropped file (drag & drop from Explorer).
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },
  // Turn a local path into a fetchable URL.
  mediaUrl: (filePath) => `shoso-media://local/?p=${encodeURIComponent(filePath)}`,
});
