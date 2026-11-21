import React from 'react';
import { IconBook } from '../lib/icons.jsx';

export default function DropOverlay() {
  return (
    <div className="drop-overlay">
      <div className="drop-card">
        <IconBook size={44} />
        <h2>שחרר כדי להוסיף ספרים</h2>
        <p>EPUB · PDF · TXT · FB2 · HTML · MD</p>
      </div>
    </div>
  );
}
