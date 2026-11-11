import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.jsx';
import './styles.css';

// Render immediately (empty library) and hydrate from disk in the background so
// the window never shows a blank screen while the library loads.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
