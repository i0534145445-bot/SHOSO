import React from 'react';
import { useStore, importFolders, removeFolder } from '../lib/store.js';
import { IconFolder, IconPlus, IconTrash } from '../lib/icons.jsx';

export default function FoldersView() {
  const folders = useStore((s) => s.folders);
  const books = useStore((s) => s.books);

  return (
    <div>
      <div className="create-row">
        <p className="dim">תיקיות שנסרקות לספרים. הסריקה רקורסיבית – כל תתי-התיקיות נכללות.</p>
        <button className="btn primary" onClick={importFolders}>
          <IconPlus size={16} /> הוסף תיקייה
        </button>
      </div>

      {folders.length === 0 ? (
        <div className="empty-state small">
          <IconFolder size={40} />
          <p>לא נוספו תיקיות עדיין</p>
        </div>
      ) : (
        <div className="folders-list">
          {folders.map((folder) => {
            const count = books.filter((b) => b.dir === folder || b.dir.startsWith(folder)).length;
            return (
              <div key={folder} className="folder-item">
                <IconFolder size={22} />
                <div className="folder-info">
                  <strong>{folder}</strong>
                  <span>{count} ספרים נמצאו</span>
                </div>
                <button className="icon-btn danger" onClick={() => removeFolder(folder)} title="הסר תיקייה">
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
