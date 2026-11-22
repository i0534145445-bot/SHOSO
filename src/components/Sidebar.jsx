import React, { useEffect } from 'react';
import {
  useStore, setView, importFolders, importFiles, toggleSidebar, toast,
} from '../lib/store.js';
import {
  IconReadingNow, IconBooksDocs, IconStar, IconClock, IconDoubleCheck,
  IconAuthor, IconCollection, IconFormat, IconFolder, IconTrash,
  IconSettings, IconFeedback, IconDownload,
} from '../lib/icons.jsx';
import Logo from './Logo.jsx';

/**
 * Readera's navigation drawer — an overlay sheet that slides in from the start
 * edge with the exact section list Readera uses:
 *   Reading Now · Books & documents · Favorites · To Read · Have Read ·
 *   Trash ── Authors · Series/Collections · Formats · Folders · Downloads ──
 *   Settings · Send feedback
 */
const SECTIONS = [
  { id: 'home', label: 'קורא עכשיו', icon: IconReadingNow },
  { id: 'books', label: 'ספרים ומסמכים', icon: IconBooksDocs },
  { id: 'favorites', label: 'מועדפים', icon: IconStar },
  { id: 'toread', label: 'לקריאה', icon: IconClock },
  { id: 'haveread', label: 'נקראו', icon: IconDoubleCheck },
  { id: 'trash', label: 'אשפה', icon: IconTrash },
  { sep: true },
  { id: 'authors', label: 'מחברים', icon: IconAuthor },
  { id: 'collections', label: 'מדפים', icon: IconCollection },
  { id: 'formats', label: 'פורמטים', icon: IconFormat },
  { id: 'folders', label: 'הוספת תיקייה', icon: IconFolder },
  { id: 'downloads', label: 'הוספת קבצים', icon: IconDownload },
  { sep: true },
  { id: 'settings', label: 'הגדרות', icon: IconSettings },
  { id: 'feedback', label: 'שליחת משוב', icon: IconFeedback },
];

export default function Sidebar() {
  const open = useStore((s) => s.drawerOpen);
  const view = useStore((s) => s.view);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') toggleSidebar(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const go = (item) => {
    toggleSidebar(false);
    if (item.id === 'feedback') {
      toast('תודה! אפשר לשלוח משוב לכתובת feedback@shoso.app', 'success');
      return;
    }
    if (item.id === 'downloads') {
      importFiles();
      return;
    }
    if (item.id === 'folders') {
      importFolders();
      return;
    }
    setView(item.id === 'books' ? 'books' : item.id);
  };

  const active = view === 'library' ? 'books' : view;

  return (
    <>
      <div className="drawer-scrim" onClick={() => toggleSidebar(false)} />
      <aside className="drawer" role="dialog" aria-label="ניווט">
        <div className="drawer-head">
          <Logo size={26} />
          <strong>SHOSO Books</strong>
        </div>
        <nav className="drawer-nav">
          {SECTIONS.map((item, i) => {
            if (item.sep) return <div className="nav-sep" key={`sep-${i}`} />; // eslint-disable-line react/no-array-index-key
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${active === item.id ? 'active' : ''}`}
                onClick={() => go(item)}
              >
                <Icon size={21} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
