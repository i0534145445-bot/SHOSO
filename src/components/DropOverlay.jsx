import React from 'react';
import { IconFolder } from '../lib/icons.jsx';

export default function DropOverlay() {
  return (
    <div className="drop-overlay">
      <div className="drop-card">
        <IconFolder size={44} />
        <h3>שחרר כאן להוספה לספרייה</h3>
        <p>תיקיות וקבצי שמע (MP3, FLAC, M4A, WAV, OGG…)</p>
      </div>
    </div>
  );
}
