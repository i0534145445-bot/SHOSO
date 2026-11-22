import React from 'react';
import { useStore, importFolders, removeFolder, rescanLibrary } from '../lib/store.js';
import { IconFolder, IconPlus, IconTrash, IconRefresh } from '../lib/icons.jsx';

/** Books live under their scan folder – compare the real paths, not the labels. */
const flat = (value) => String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');
const inFolder = (book, folder) => {
  const bookPath = flat(book.path);
  const folderPath = flat(folder);
  if (!bookPath || !folderPath) return false;
  return bookPath === folderPath || bookPath.startsWith(`${folderPath}/`);
};

export default function FoldersView() {
  const folders = useStore((s) => s.folders);
  const books = useStore((s) => s.books);
  const scanStatus = useStore((s) => s.scanStatus);
  const scanning = Boolean(scanStatus);

  return (
    <div>
      <div className="create-row">
        <p className="dim">
          תיקיות שנסרקות לספרים. הסריקה רקורסיבית – כל תתי-התיקיות נכללות.
          הספרים לא מועתקים, והסרת תיקייה מעבירה את ספריה לאשפה (אפשר לשחזר).
          הסריקה רצה לבד בכל הפעלה, ועוקבת אחרי התיקיות כשהן משתנות.
        </p>
        <div className="create-actions">
          <button className="btn primary" onClick={importFolders}>
            <IconPlus size={16} /> הוסף תיקייה
          </button>
          <button
            className="btn"
            onClick={() => rescanLibrary()}
            disabled={scanning || !folders.length}
            title="הספרייה נסרקת מחדש: קבצים חדשים נכנסים, קבצים שנמחקו יורדים"
          >
            <IconRefresh size={16} /> {scanning ? 'סורק…' : 'סרוק עכשיו'}
          </button>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="empty-state small">
          <IconFolder size={40} />
          <p>לא נוספו תיקיות עדיין</p>
        </div>
      ) : (
        <div className="folders-list">
          {folders.map((folder) => {
            const count = books.filter((b) => inFolder(b, folder)).length;
            return (
              <div key={folder} className="folder-item">
                <IconFolder size={22} />
                <div className="folder-info">
                  <strong>{folder}</strong>
                  <span>{count} ספרים נמצאו</span>
                </div>
                <button
                  className="icon-btn danger"
                  onClick={() => removeFolder(folder)}
                  title="הסר תיקייה (הספרים שלה יעברו לאשפה)"
                >
                  <IconTrash size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
