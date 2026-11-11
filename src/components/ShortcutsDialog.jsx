import React from 'react';
import { IconClose } from '../lib/icons.jsx';

const SHORTCUTS = [
  ['רווח', 'נגן / השהה'],
  ['חץ ימינה / שמאלה', 'קדימה / אחורה 5 שניות'],
  ['Ctrl + חץ ימינה / שמאלה', 'השיר הבא / הקודם'],
  ['חץ למעלה / למטה', 'הגברת / הנמכת מהירות נגינה'],
  ['M', 'השתקה'],
  ['L', 'נגן / השהה'],
  ['/  או  Ctrl+F', 'חיפוש'],
  ['Ctrl + I', 'הוספת תיקיית מוזיקה'],
  ['F1', 'מקשי קיצור'],
];

export default function ShortcutsDialog({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>מקשי קיצור</h2>
          <button className="icon-btn" onClick={onClose} title="סגור">
            <IconClose />
          </button>
        </div>
        <div className="shortcut-grid">
          {SHORTCUTS.map(([keys, action]) => (
            <div className="shortcut-row" key={keys}>
              <kbd>{keys}</kbd>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
