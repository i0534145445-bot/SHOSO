import React from 'react';
import { useStore, setView, importFolders, importFiles, toggleSidebar } from '../lib/store.js';
import {
  IconHome, IconLibrary, IconAuthor, IconFormat, IconFolder, IconHeart,
  IconHistory, IconCollection, IconSettings, IconPlus, IconClose,
} from '../lib/icons.jsx';
import Logo from './Logo.jsx';

const NAV = [
  { id: 'home', label: 'בית', icon: IconHome },
  { id: 'library', label: 'ספרייה', icon: IconLibrary },
  { id: 'authors', label: 'מחברים', icon: IconAuthor },
  { id: 'formats', label: 'פורמטים', icon: IconFormat },
  { id: 'favorites', label: 'מועדפים', icon: IconHeart },
  { id: 'history', label: 'היסטוריה', icon: IconHistory },
  { id: 'collections', label: 'מדפים', icon: IconCollection },
  { id: 'folders', label: 'תיקיות', icon: IconFolder },
];

export default function Sidebar() {
  const view = useStore((s) => s.view);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const bookCount = useStore((s) => s.books.length);
  const favCount = useStore((s) => s.favorites.length);
  const colCount = useStore((s) => s.collections.length);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <Logo size={34} />
        {!collapsed && (
          <div className="brand-text">
            <strong>SHOSO Books</strong>
            <span>קורא ספרים שולחני</span>
          </div>
        )}
        <button className="icon-btn sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'הרחב' : 'כווץ'}>
          <IconClose size={16} />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="sidebar-actions">
            <button className="btn primary block" onClick={importFolders}>
              <IconPlus size={16} /> הוסף תיקיות
            </button>
            <button className="btn ghost block" onClick={importFiles}>
              <IconPlus size={16} /> הוסף קבצים
            </button>
          </div>

          <nav className="nav">
            {NAV.map((item) => {
              const Icon = item.icon;
              const badge = item.id === 'library' ? bookCount : item.id === 'favorites' ? favCount : item.id === 'collections' ? colCount : null;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${view === item.id ? 'active' : ''}`}
                  onClick={() => setView(item.id)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {badge !== null && badge > 0 && <span className="nav-badge">{badge}</span>}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-foot">
            <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
              <IconSettings size={19} />
              <span>הגדרות</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
