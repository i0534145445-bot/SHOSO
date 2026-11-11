import React, { useState } from 'react';
import {
  useStore, folderGroups, playQueue, importFolders, rescanLibrary, removeLibrary,
} from '../lib/store.js';
import { revealInExplorer } from '../lib/platform.js';
import Cover from '../components/Cover.jsx';
import TrackList from '../components/TrackList.jsx';
import { IconFolder, IconPlay, IconRefresh, IconTrash, IconChevron } from '../lib/icons.jsx';
import { formatTime } from '../lib/format.js';

export default function FoldersView() {
  const groups = useStore(() => folderGroups());
  const folders = useStore((s) => s.folders);
  const [selected, setSelected] = useState(null);

  const active = groups.find((g) => g.dir === selected) || null;

  if (active) {
    return (
      <div className="view">
        <div className="view-head">
          <div>
            <button className="link back" onClick={() => setSelected(null)}>→ כל התיקיות</button>
            <h2 className="view-title">{active.name}</h2>
            <p className="view-sub" dir="ltr">{active.dir}</p>
          </div>
          <div className="inline-actions">
            <button className="btn primary" onClick={() => playQueue(active.tracks.map((t) => t.id), 0)}>
              <IconPlay size={16} /> נגן תיקייה
            </button>
            <button className="btn ghost" onClick={() => revealInExplorer(active.dir)}>פתח ב-Explorer</button>
          </div>
        </div>
        <TrackList tracks={active.tracks} />
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">תיקיות</h2>
          <p className="view-sub">{folders.length} תיקיות בסריקה · {groups.length} תיקיות עם מוזיקה</p>
        </div>
        <div className="inline-actions">
          <button className="btn primary" onClick={() => importFolders()}><IconFolder size={16} /> הוסף תיקייה</button>
          <button className="btn ghost" onClick={() => rescanLibrary()}><IconRefresh size={16} /> סרוק מחדש</button>
          <button
            className="btn danger-ghost"
            onClick={() => window.confirm('לרוקן את כל הספרייה? קובצי המוזיקה לא יימחקו מהמחשב.') && removeLibrary()}
          >
            <IconTrash size={16} /> נקה ספרייה
          </button>
        </div>
      </div>

      {folders.length > 0 && (
        <section className="shelf">
          <div className="shelf-head"><h3>תיקיות מקור</h3></div>
          <div className="folder-chips">
            {folders.map((folder) => (
              <span className="chip static" key={folder} dir="ltr" title={folder}>{folder}</span>
            ))}
          </div>
        </section>
      )}

      <div className="grid-cards">
        {groups.map((group) => (
          <button key={group.dir} className="card folder-card" onClick={() => setSelected(group.dir)}>
            <div className="folder-art">
              <Cover src={group.tracks[0]?.picture} name={group.name} size={92} rounded={12} />
              <IconFolder size={22} className="folder-icon" />
            </div>
            <div className="card-title">{group.name}</div>
            <div className="card-sub">
              {group.tracks.length} שירים · {formatTime(group.tracks.reduce((s, t) => s + (t.duration || 0), 0), { hours: true })}
            </div>
          </button>
        ))}
      </div>

      {!groups.length && (
        <div className="empty-state">
          <p>לא נמצאו שירים. הוסף תיקיית מוזיקה כדי להתחיל.</p>
          <button className="btn primary" onClick={() => importFolders()}><IconFolder size={16} /> בחר תיקייה</button>
        </div>
      )}
    </div>
  );
}
