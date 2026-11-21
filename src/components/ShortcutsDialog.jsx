import React from 'react';
import { IconClose } from '../lib/icons.jsx';

const SHORTCUTS = [
  ['/', 'חיפוש'],
  ['Ctrl + O', 'ייבוא ספרים'],
  ['Esc', 'סגירה / ניקוי חיפוש'],
  ['F1', 'חלון קיצורים זה'],
  ['בקורא: ← →', 'פרק קודם / הבא'],
  ['בקורא: PgUp / PgDn', 'גלילה בעמוד'],
  ['בקורא: B', 'סימנייה'],
  ['בקורא: F', 'מסך מלא'],
  ['בקורא: T', 'תוכן עניינים'],
  ['בקורא: S', 'חיפוש בספר'],
  ['בקורא: A', 'הגדרות קריאה'],
];

export default function ShortcutsDialog({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>קיצורי מקלדת</h2>
          <button className="icon-btn" onClick={onClose}><IconClose size={18} /></button>
        </div>
        <table className="shortcuts-table">
          <tbody>
            {SHORTCUTS.map(([key, desc]) => (
              <tr key={key}>
                <td><kbd>{key}</kbd></td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
