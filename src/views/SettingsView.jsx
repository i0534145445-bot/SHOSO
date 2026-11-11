import React from 'react';
import {
  useStore, setTheme, setAccent, setVisualizer, importFolders, rescanLibrary, removeLibrary,
  setRate, appInfo, isDesktop, toggleSidebar, loadDemoLibrary,
} from '../lib/store.js';
import Equalizer from '../components/Equalizer.jsx';
import { IconFolder, IconRefresh, IconTrash, IconGauge, IconSparkle, IconKeyboard } from '../lib/icons.jsx';
import Logo from '../components/Logo.jsx';

const ACCENTS = [
  { id: 'violet', label: 'סגול', color: '#8b5cf6' },
  { id: 'emerald', label: 'ירוק', color: '#10b981' },
  { id: 'amber', label: 'ענבר', color: '#f59e0b' },
  { id: 'rose', label: 'ורוד', color: '#f43f5e' },
  { id: 'sky', label: 'תכלת', color: '#0ea5e9' },
];

const VISUALIZERS = [
  { id: 'bars', label: 'ספקטרום' },
  { id: 'wave', label: 'גל' },
  { id: 'off', label: 'כבוי' },
];

export default function SettingsView() {
  const theme = useStore((s) => s.theme);
  const accent = useStore((s) => s.accent);
  const visualizer = useStore((s) => s.visualizer);
  const rate = useStore((s) => s.rate);
  const folders = useStore((s) => s.folders);
  const trackCount = useStore((s) => s.tracks.length);

  return (
    <div className="view settings">
      <div className="view-head">
        <div>
          <h2 className="view-title">הגדרות</h2>
          <p className="view-sub">התאם את הנגן לטעם שלך</p>
        </div>
      </div>

      <section className="settings-card">
        <h3>מראה</h3>
        <div className="setting-row">
          <div>
            <div className="setting-title">ערכת נושא</div>
            <div className="hint">מצב כהה מומלץ להאזנה בלילה</div>
          </div>
          <div className="segmented">
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>כהה</button>
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>בהיר</button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-title">צבע מבטא</div>
            <div className="hint">צבע הכפתורים וההדגשות</div>
          </div>
          <div className="accent-row">
            {ACCENTS.map((item) => (
              <button
                key={item.id}
                className={`accent-dot ${accent === item.id ? 'active' : ''}`}
                style={{ background: item.color }}
                title={item.label}
                onClick={() => setAccent(item.id)}
              />
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-title">ויזואליזר</div>
            <div className="hint">אנימציה בעטיפת השיר המתנגן</div>
          </div>
          <div className="segmented">
            {VISUALIZERS.map((item) => (
              <button
                key={item.id}
                className={visualizer === item.id ? 'active' : ''}
                onClick={() => setVisualizer(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-title">סרגל צד</div>
            <div className="hint">מצב מצומצם חוסך מקום</div>
          </div>
          <button className="btn ghost" onClick={toggleSidebar}>החלף מצב</button>
        </div>
      </section>

      <section className="settings-card">
        <Equalizer />
      </section>

      <section className="settings-card">
        <h3>נגינה</h3>
        <div className="setting-row">
          <div>
            <div className="setting-title">מהירות נגינה</div>
            <div className="hint">שומר על גובה הצליל – מצוין ללימוד שפות או תרגול</div>
          </div>
          <div className="rate-control">
            <IconGauge />
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              dir="ltr"
            />
            <span>{rate.toFixed(2)}x</span>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h3>ספרייה</h3>
        <div className="setting-row">
          <div>
            <div className="setting-title">תיקיות מקור ({folders.length})</div>
            <div className="hint">{trackCount} שירים בספרייה</div>
          </div>
          <div className="inline-actions">
            <button className="btn primary" onClick={() => importFolders()}><IconFolder size={16} /> הוסף תיקייה</button>
            <button className="btn ghost" onClick={() => rescanLibrary()}><IconRefresh size={16} /> סרוק מחדש</button>
            <button className="btn ghost" onClick={() => loadDemoLibrary()}><IconSparkle size={16} /> טען דמו</button>
          </div>
        </div>
        {folders.length > 0 && (
          <div className="folder-chips">
            {folders.map((folder) => (
              <span className="chip static" key={folder} dir="ltr" title={folder}>{folder}</span>
            ))}
          </div>
        )}
        <div className="setting-row">
          <div>
            <div className="setting-title">איפוס ספרייה</div>
            <div className="hint">קובצי המוזיקה במחשב לא יימחקו</div>
          </div>
          <button
            className="btn danger-ghost"
            onClick={() => window.confirm('לרוקן את הספרייה?') && removeLibrary()}
          >
            <IconTrash size={16} /> רוקן ספרייה
          </button>
        </div>
      </section>

      <section className="settings-card about">
        <Logo size={44} />
        <div>
          <div className="setting-title">SHOSO Music <span className="hint">גרסה {appInfo.version}</span></div>
          <p className="hint">
            נגן מוזיקה שולחני לווינדוס בלבד · בנוי עם Electron + React.
            {isDesktop ? ` · Electron ${appInfo.electron || ''}` : ' · מצב דפדפן (הדגמה)'}
          </p>
          <p className="hint">קיצורי מקלדת: רווח לנגן/השהה, חצים לדילוג, M להשתקה, F1 לרשימה מלאה.</p>
        </div>
      </section>
    </div>
  );
}
