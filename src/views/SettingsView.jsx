import React, { useState } from 'react';
import { useStore, setTheme, setAccent, updateReader, toast, setState } from '../lib/store.js';
import { FONT_FAMILIES } from '../lib/store.js';
import { createDemoBooks } from '../lib/demo.js';
import { IconSun, IconMoon, IconSparkle, IconBook } from '../lib/icons.jsx';
import { appInfo } from '../lib/platform.js';

const ACCENTS = [
  { id: 'violet', label: 'סגול', color: '#8b5cf6' },
  { id: 'emerald', label: 'ירוק', color: '#10b981' },
  { id: 'amber', label: 'ענבר', color: '#f59e0b' },
  { id: 'rose', label: 'ורוד', color: '#f43f5e' },
  { id: 'sky', label: 'שמיים', color: '#0ea5e9' },
];

export default function SettingsView() {
  const theme = useStore((s) => s.theme);
  const accent = useStore((s) => s.accent);
  const reader = useStore((s) => s.reader);
  const bookCount = useStore((s) => s.books.length);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      const { default: store } = await import('../lib/store.js');
      const demo = await createDemoBooks();
      // Merge demo books via internal merge path: use setState + persist
      const existing = new Map(store.getState().books.map((b) => [b.id, b]));
      demo.forEach((b) => existing.set(b.id, b));
      store.setState({ books: [...existing.values()] });
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
          <span>צבע מבטא</span>
          <div className="accent-row">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                className={`accent-dot ${accent === a.id ? 'active' : ''}`}
                style={{ background: a.color }}
                title={a.label}
                onClick={() => setAccent(a.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h2>קריאה (ברירת מחדל)</h2>
        <div className="setting-row">
          <span>ערכת נושא בקורא</span>
          <div className="seg">
            {['light', 'dark', 'sepia', 'night'].map((t) => (
              <button key={t} className={reader.theme === t ? 'active' : ''} onClick={() => updateReader({ theme: t })}>
                {t === 'light' ? 'בהיר' : t === 'dark' ? 'כהה' : t === 'sepia' ? 'ספיה' : 'לילה'}
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
      </section>

      <section className="settings-card">
        <h2>ספרי דמו</h2>
        <p className="dim">אין קבצים? טען שלושה ספרי דמו שנוצרים בדפדפן – EPUB אמיתי בעברית, TXT באנגלית ו-FB2 בעברית. הם מפעילים את כל מנועי הקריאה.</p>
        <button className="btn primary" onClick={loadDemo} disabled={loadingDemo}>
          <IconSparkle size={16} /> {loadingDemo ? 'טוען…' : 'טען ספרי דמו'}
        </button>
        <p className="dim small">ספרייה נוכחית: {bookCount} ספרים · מצב: {appInfo.desktop ? 'אפליקציית Windows (Electron)' : 'דפדפן (מצב דמו)'}</p>
      </section>

      <section className="settings-card">
        <h2>אודות</h2>
        <p><strong>SHOSO Books</strong> – קורא ספרים שולחני ל-Windows, חלופה ל-Readera לאנדרואיד.</p>
        <p className="dim">פורמטים: EPUB · PDF · TXT · FB2 · HTML · MD. כל הנתונים נשארים על המחשב – אין שרת ואין חשבון.</p>
        <p className="dim small">גרסה {appInfo.version} · Electron {appInfo.electron || '—'}</p>
      </section>
    </div>
  );
}
