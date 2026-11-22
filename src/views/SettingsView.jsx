import React, { useState } from 'react';
import {
  useStore, setTheme, updateReader, toast, setState, getState, setSort,
  setLayout, importFolders, COLOR_MODES, FONT_FAMILIES,
} from '../lib/store.js';
import { createDemoBooks } from '../lib/demo.js';
import {
  IconChevron, IconBooksDocs, IconTrash, IconFolder, IconSparkle,
  IconPalette, IconTextFields, IconFormatLineSpacing, IconFormatAlignJustify,
  IconMargin, IconSwapHoriz, IconSwapVert, IconGrid, IconList, IconSort,
  IconInfo, IconStorage,
} from '../lib/icons.jsx';
import { appInfo } from '../lib/platform.js';

/**
 * ReadEra's Settings screen: section headers with a single list of rows –
 * label on the start side, current value and a chevron on the end side,
 * switches for booleans. No cards, no gradients.
 */

function Section({ title, children }) {
  return (
    <section className="settings-section">
      <h2 className="settings-section-title">{title}</h2>
      <div className="settings-rows">{children}</div>
    </section>
  );
}

function Row({ icon, label, value, onClick, children, chevron = true }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="settings-row" onClick={onClick}>
      {icon && <span className="settings-row-icon">{icon}</span>}
      <span className="settings-row-label">{label}</span>
      {children}
      {value !== undefined && <span className="settings-row-value">{value}</span>}
      {onClick && chevron && <IconChevron size={18} className="settings-row-chevron" />}
    </Tag>
  );
}

function Switch({ checked, onChange }) {
  return (
    <input
      className="settings-switch"
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

const modeLabel = (id) => (COLOR_MODES.find((m) => m.id === id) || COLOR_MODES[2]).label;
const fontLabel = (id) => (FONT_FAMILIES.find((f) => f.id === id) || FONT_FAMILIES[0]).label;

export default function SettingsView() {
  const theme = useStore((s) => s.theme);
  const reader = useStore((s) => s.reader);
  const layout = useStore((s) => s.layout);
  const sort = useStore((s) => s.sort);
  const bookCount = useStore((s) => s.books.length);
  const trashCount = useStore((s) => s.trash.length);
  const folderCount = useStore((s) => s.folders.length);
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

  const cycleMode = () => {
    const idx = COLOR_MODES.findIndex((m) => m.id === reader.theme);
    const next = COLOR_MODES[(idx + 1) % COLOR_MODES.length];
    updateReader({ theme: next.id });
  };

  return (
    <div className="settings-view">
      <Section title="קריאה">
        <Row icon={<IconPalette size={20} />} label="מצב צבע" value={modeLabel(reader.theme)} onClick={cycleMode} />
        <Row icon={<IconTextFields size={20} />} label="גופן">
          <select
            className="settings-inline-select"
            value={reader.fontFamily}
            onChange={(e) => updateReader({ fontFamily: e.target.value })}
          >
            {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </Row>
        <Row icon={<IconTextFields size={20} />} label="גודל גופן">
          <div className="settings-stepper">
            <button onClick={() => updateReader({ fontSize: Math.max(12, reader.fontSize - 1) })}>−</button>
            <em>{reader.fontSize}</em>
            <button onClick={() => updateReader({ fontSize: Math.min(32, reader.fontSize + 1) })}>+</button>
          </div>
        </Row>
        <Row icon={<IconFormatLineSpacing size={20} />} label="ריווח שורות">
          <div className="settings-stepper">
            <button onClick={() => updateReader({ lineHeight: Math.max(1.2, Number((reader.lineHeight - 0.1).toFixed(1))) })}>−</button>
            <em>{Math.round((reader.lineHeight / 1.7) * 100)}%</em>
            <button onClick={() => updateReader({ lineHeight: Math.min(2.4, Number((reader.lineHeight + 0.1).toFixed(1))) })}>+</button>
          </div>
        </Row>
        <Row icon={<IconMargin size={20} />} label="שולי עמוד" value={`${reader.margins}px`} chevron={false} />
        <Row icon={<IconFormatAlignJustify size={20} />} label="יישור טקסט">
          <Switch checked={reader.justify} onChange={(v) => updateReader({ justify: v })} />
        </Row>
        <Row icon={<IconSwapHoriz size={20} />} label="כיוון דפדוף">
          <div className="settings-seg">
            <button className={reader.mode === 'paginated' ? 'active' : ''} onClick={() => updateReader({ mode: 'paginated' })}>
              <IconSwapHoriz size={16} /> אופקי
            </button>
            <button className={reader.mode === 'scroll' ? 'active' : ''} onClick={() => updateReader({ mode: 'scroll' })}>
              <IconSwapVert size={16} /> אנכי
            </button>
          </div>
        </Row>
      </Section>

      <Section title="ספרייה">
        <Row icon={<IconGrid size={20} />} label="תצוגת ספרייה">
          <div className="settings-seg">
            <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>
              <IconList size={16} /> רשימה
            </button>
            <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>
              <IconGrid size={16} /> כריכות
            </button>
          </div>
        </Row>
        <Row icon={<IconSort size={20} />} label="מיון לפי" value={{
          title: 'שם הספר', author: 'מחבר', added: 'תאריך הוספה', size: 'גודל', progress: 'התקדמות',
        }[sort.key] || 'שם הספר'} chevron={false} />
        <Row icon={<IconFolder size={20} />} label="תיקיות לסריקה" value={folderCount} onClick={() => importFolders()} />
        <Row icon={<IconBooksDocs size={20} />} label="ספרים בספרייה" value={bookCount} chevron={false} />
        <Row icon={<IconTrash size={20} />} label="אשפה" value={trashCount} onClick={() => setState({ view: 'trash' })} />
      </Section>

      <Section title="מראה">
        <Row icon={<IconPalette size={20} />} label="ערכת נושא של הממשק">
          <div className="settings-seg">
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>כהה</button>
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>בהיר</button>
          </div>
        </Row>
      </Section>

      <Section title="ספרי דמו">
        <Row
          icon={<IconSparkle size={20} />}
          label={loadingDemo ? 'טוען…' : 'טען ספרי דמו'}
          value="EPUB · FB2 · TXT · MD · HTML"
          onClick={loadingDemo ? undefined : loadDemo}
          chevron={false}
        />
        <Row icon={<IconStorage size={20} />} label="מצב הרצה" value={appInfo.desktop ? 'Windows (Electron)' : 'דפדפן (דמו)'} chevron={false} />
      </Section>

      <Section title="אודות">
        <Row icon={<IconInfo size={20} />} label="SHOSO Books" value={`גרסה ${appInfo.version}`} chevron={false} />
        <Row label="פורמטים נתמכים" value="EPUB · PDF · FB2 · TXT · DOCX · MD" chevron={false} />
        <Row label="פרטיות" value="הכל נשאר על המחשב" chevron={false} />
      </Section>
    </div>
  );
}
