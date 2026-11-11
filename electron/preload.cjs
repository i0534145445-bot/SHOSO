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
  scan: (folders) => ipcRenderer.invoke('library:scan', folders),
  onScanProgress: (cb) => on('library:progress', cb),
  refreshTrack: (filePath) => ipcRenderer.invoke('track:refresh', filePath),
  lyrics: (track) => ipcRenderer.invoke('track:lyrics', track),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  saveLibrary: (library) => ipcRenderer.invoke('library:save', library),
  reveal: (filePath) => ipcRenderer.invoke('shell:reveal', filePath),
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
  // Turn a local path into a playable URL.
  mediaUrl: (filePath) => `shoso-media://local/?p=${encodeURIComponent(filePath)}`,
});
