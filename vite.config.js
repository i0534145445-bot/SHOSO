import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: shoso-media:",
  "media-src 'self' data: blob: shoso-media:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self' data:",
  "connect-src 'self' data: blob: shoso-media:",
].join('; ');

/**
 * Adds a strict Content-Security-Policy to packaged builds only: the Vite dev
 * server relies on inline scripts (React refresh preamble), which a strict CSP
 * would block.
 */
const cspPlugin = () => ({
  name: 'shoso-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '</head>',
      `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`,
    );
  },
});

// `base: './'` is required so the built app loads from file:// inside Electron.
export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.jsx'],
    setupFiles: ['./tests/setup.js'],
    css: false,
  },
});
