import React, { useState } from 'react';
import {
  useStore, setTheme, updateReader, toast, setState, getState, COLOR_MODES,
  FONT_FAMILIES,
} from '../lib/store.js';
import { createDemoBooks } from '../lib/demo.js';
import { IconSun, IconMoon, IconSparkle, IconTrash, IconBooksDocs } from '../lib/icons.jsx';
import { appInfo } from '../lib/platform.js';

export default function SettingsView() {
  const theme = useStore((s) => s.theme);
  const reader = useStore((s) => s.reader);
  const layout = useStore((s) => s.layout);
  const bookCount = useStore((s) => s.books.length);
  const trashCount = useStore((s) => s.trash.length);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      const demo = await createDemoBooks();
      const existing = new Map(getState().books.map((b) => [b.id, b]));
      demo.forEach((b) => existing.set(b.id, b));
      setState({ books: [...existing.values()] });
      toast(`נטענו ${demo.length} ספרי דמו – פתח אותם מהספרייה`, 'success');
    } catch (err) {
      toast(`שגיאה בטעינת דמו: ${err.message}`, 'error');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="settings-view">
      <section className="settings-card">
        <h2>מראה</h2>
        <div className="setting-row">
          <span>ערכת נושא</span>
          <div className="seg">
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
              <IconMoon size={15} /> כהה
            </button>
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
              <IconSun size={15} /> בהיר
            </button>
          </div>
        </div>
        <div className="setting-row">
          <span>פריסת ספרייה</span>
          <div className="seg">
            <button
              className={layout === 'list' ? 'active' : ''}
              onClick={() => setState({ layout: 'list' })}
            >
              רשימה
            </button>
            <button
              className={layout === 'grid' ? 'active' : ''}
              onClick={() => setState({ layout: 'grid' })}
            >
              כריכות
            </button>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h2>קריאה (ברירת מחדל)</h2>
        <div className="setting-row">
          <span>מצב צבע</span>
          <div className="seg">
            {COLOR_MODES.map((m) => (
              <button key={m.id} className={reader.theme === m.id ? 'active' : ''} onClick={() => updateReader({ theme: m.id })}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span>גופן</span>
          <select value={reader.fontFamily} onChange={(e) => updateReader({ fontFamily: e.target.value })}>
            {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div className="setting-row">
          <span>גודל גופן: {reader.fontSize}px</span>
          <input type="range" min="12" max="32" value={reader.fontSize} onChange={(e) => updateReader({ fontSize: Number(e.target.value) })} />
        </div>
        <div className="setting-row">
          <span>ריווח שורות: {reader.lineHeight}</span>
          <input type="range" min="1.2" max="2.4" step="0.1" value={reader.lineHeight} onChange={(e) => updateReader({ lineHeight: Number(e.target.value) })} />
        </div>
        <div className="setting-row">
          <span>שוליים: {reader.margins}px</span>
          <input type="range" min="0" max="120" step="4" value={reader.margins} onChange={(e) => updateReader({ margins: Number(e.target.value) })} />
        </div>
      </section>

      <section className="settings-card">
        <h2>ספרייה</h2>
        <div className="setting-row">
          <span><IconBooksDocs size={16} /> ספרים בספרייה</span>
          <strong>{bookCount}</strong>
        </div>
        <div className="setting-row">
          <span><IconTrash size={16} /> ספרים באשפה</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <strong>{trashCount}</strong>
            <button className="btn ghost small" onClick={() => setState({ view: 'trash' })}>פתח אשפה</button>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h2>ספרי דמו</h2>
        <p className="dim">
          אין קבצים? טען שלושה ספרי דמו שנוצרים בדפדפן – EPUB אמיתי בעברית, TXT באנגלית
          ו-FB2 בעברית. הם מפעילים את כל מנועי הקריאה.
        </p>
        <button className="btn primary" onClick={loadDemo} disabled={loadingDemo}>
          <IconSparkle size={16} /> {loadingDemo ? 'טוען…' : 'טען ספרי דמו'}
        </button>
        <p className="dim small" style={{ marginTop: 12 }}>
          ספרייה נוכחית: {bookCount} ספרים · מצב: {appInfo.desktop ? 'אפליקציית Windows (Electron)' : 'דפדפן (מצב דמו)'}
        </p>
      </section>

      <section className="settings-card">
        <h2>אודות</h2>
        <p><strong>SHOSO Books</strong> – קורא ספרים שולחני ל-Windows בעיצוב Readera.</p>
        <p className="dim">
          פורמטים: EPUB · PDF · TXT · FB2 · HTML · MD. כל הנתונים נשארים על המחשב –
          אין שרת ואין חשבון.
        </p>
        <p className="dim small">גרסה {appInfo.version} · Electron {appInfo.electron || '—'}</p>
      </section>
    </div>
  );
}
