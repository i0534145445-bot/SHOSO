import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.jsx';
import { bootstrap } from './lib/store.js';
import './lib/fonts.js';
import './styles.css';

// Render immediately (empty library) and hydrate from disk in the background so
// the window never shows a blank screen while the library loads.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// A real, measurable benchmark needs to hand the app a big library. The hook
// only exists when the page is opened with ?bench=1.
if (new URLSearchParams(window.location.search).has('bench')) {
  import('./lib/store.js').then((store) => {
    window.shosoDebug = { setState: store.setState, getState: store.getState, setView: store.setView };
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('SHOSO Books bootstrap failed', err);
});
