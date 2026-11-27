import React, { useState } from 'react';
import {
  useStore, setTheme, updateReader, setState, getState, setSort,
  setLayout, importFolders, toast, COLOR_MODES, FONT_FAMILIES, rescanLibrary,
  setScanOption, checkForUpdate, downloadUpdate, setUpdatesOption,
} from '../lib/store.js';
import { createDemoBooks } from '../lib/demo.js';
import { IconChevron } from '../lib/icons.jsx';
import { appInfo, openDefaultApps } from '../lib/platform.js';
import { updateStatusLine } from '../lib/updates.js';
import { VIEW_MODES } from '../components/BookList.jsx';

/**
 * ReadEra's Settings screen, row for row:
 *   • small gold uppercase section captions ("GENERAL", "LIBRARY", …)
 *   • rows are two lines – a bold-ish label and a dim description
 *   • the current value / control sits at the end of the row
 *   • no leading icons, no cards, hairline-free spacing
 */

function Section({ title, children }) {
  return (
    <section className="settings-section">
      <h2 className="settings-section-title">{title}</h2>
      <div className="settings-rows">{children}</div>
    </section>
  );
}

function Row({ label, desc, value, onClick, children, chevron = true }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`settings-row${onClick ? ' tap' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {desc && <span className="settings-row-desc">{desc}</span>}
      </span>
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

function Stepper({ value, onDec, onInc }) {
  return (
    <div className="settings-stepper">
      <button type="button" onClick={onDec}>−</button>
      <em>{value}</em>
      <button type="button" onClick={onInc}>+</button>
    </div>
  );
}

const modeLabel = (id) => (COLOR_MODES.find((m) => m.id === id) || COLOR_MODES[2]).label;

/** "לפני 3 דקות" for the update check line. */
const sinceLabel = (ts) => {
  if (!ts) return 'עוד לא נבדק';
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return 'נבדק עכשיו';
  if (minutes < 60) return `נבדק לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'נבדק לפני שעה' : `נבדק לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'נבדק אתמול' : `נבדק לפני ${days} ימים`;
};

const SORT_LABEL = {
  title: 'שם הספר', author: 'מחבר', added: 'תאריך הוספה', size: 'גודל', progress: 'התקדמות',
};

export default function SettingsView() {
  const theme = useStore((s) => s.theme);
  const reader = useStore((s) => s.reader);
  const layout = useStore((s) => s.layout);
  const sort = useStore((s) => s.sort);
  const bookCount = useStore((s) => s.books.length);
  const trashCount = useStore((s) => s.trash.length);
  const recentCount = useStore((s) => s.recent.length);
  const folderCount = useStore((s) => s.folders.length);
  const scanStatus = useStore((s) => s.scanStatus);
  const scan = useStore((s) => s.scan);
  const updates = useStore((s) => s.updates);
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
    updateReader({ theme: COLOR_MODES[(idx + 1) % COLOR_MODES.length].id });
  };

  return (
    <div className="settings-view">
      <Section title="כללי">
        <Row
          label="מצב צבע"
          desc="ערכת הצבעים של דף הקריאה"
          value={modeLabel(reader.theme)}
          onClick={cycleMode}
        />
        <Row
          label="תצוגת ספרייה"
          desc={VIEW_MODES.find((m) => m.id === layout)?.hint}
          value={VIEW_MODES.find((m) => m.id === layout)?.label}
          onClick={() => {
            const idx = VIEW_MODES.findIndex((m) => m.id === layout);
            setLayout(VIEW_MODES[(idx + 1) % VIEW_MODES.length].id);
          }}
        />
        <Row
          label="מיון לפי"
          desc="סדר הספרים ברשימה"
          value={SORT_LABEL[sort.key] || 'שם הספר'}
          onClick={() => setSort({ key: sort.key === 'title' ? 'added' : 'title', dir: 'asc' })}
        />
        <Row
          label="תיקיות לסריקה"
          desc="הוספת תיקייה מהמחשב לספרייה"
          value={folderCount ? `${folderCount} תיקיות` : 'לא נוספו'}
          onClick={() => importFolders()}
        />
      </Section>

      <Section title="קריאה">
        <Row
          label="גופן"
          desc="גופן הטקסט בעמוד הקריאה"
        >
          <select
            className="settings-inline-select"
            value={reader.fontFamily}
            onChange={(e) => updateReader({ fontFamily: e.target.value })}
          >
            {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </Row>
        <Row label="גודל גופן" desc={`${reader.fontSize} נקודות`}>
          <Stepper
            value={reader.fontSize}
            onDec={() => updateReader({ fontSize: Math.max(12, reader.fontSize - 1) })}
            onInc={() => updateReader({ fontSize: Math.min(32, reader.fontSize + 1) })}
          />
        </Row>
        <Row label="ריווח שורות" desc={`${Math.round((reader.lineHeight / 1.7) * 100)}%`}>
          <Stepper
            value={`${Math.round((reader.lineHeight / 1.7) * 100)}%`}
            onDec={() => updateReader({ lineHeight: Math.max(1.2, Number((reader.lineHeight - 0.1).toFixed(1))) })}
            onInc={() => updateReader({ lineHeight: Math.min(2.4, Number((reader.lineHeight + 0.1).toFixed(1))) })}
          />
        </Row>
        <Row label="שולי עמוד" desc={`${reader.margins}px מכל צד`} value={`${reader.margins}px`} />
        <Row label="יישור טקסט" desc="יישור לשני הצדדים">
          <Switch checked={reader.justify} onChange={(v) => updateReader({ justify: v })} />
        </Row>
        <Row label="כיוון דפדוף" desc={reader.mode === 'paginated' ? 'אופקי – כמו ספר' : 'אנכי – גלילה'}>
          <div className="settings-seg">
            <button className={reader.mode === 'paginated' ? 'active' : ''} onClick={() => updateReader({ mode: 'paginated' })}>
              אופקי
            </button>
            <button className={reader.mode === 'scroll' ? 'active' : ''} onClick={() => updateReader({ mode: 'scroll' })}>
              אנכי
            </button>
          </div>
        </Row>
      </Section>

      <Section title="ספרייה">
        <Row label="ספרים בספרייה" desc="כל הספרים שנוספו" value={bookCount} />
        <Row label="אשפה" desc="ספרים שנמחקו – שחזור אפשרי" value={trashCount} onClick={() => setState({ view: 'trash' })} />
        <Row label="היסטוריית קריאה" desc="הספרים שנפתחו לאחרונה" value={`${recentCount} ספרים`} onClick={() => setState({ view: 'history' })} />
        <Row label="סריקה אוטומטית בהפעלה" desc="הספרייה מתיישרת עם הדיסק בכל פתיחה של האפליקציה">
          <Switch checked={scan.onStart} onChange={(v) => setScanOption('onStart', v)} />
        </Row>
        <Row label="מעקב אחרי התיקיות" desc="קובץ שנוסף או נמחק בתיקייה נסרקת מתעדכן מיד">
          <Switch checked={scan.watch} onChange={(v) => setScanOption('watch', v)} />
        </Row>
        <Row label="הסרת ספרים שנעלמו" desc="ספר שהקובץ שלו נמחק או הועבר יורד מהספרייה">
          <Switch checked={scan.pruneMissing} onChange={(v) => setScanOption('pruneMissing', v)} />
        </Row>
        <Row label="הסרת תיקייה" desc={scan.folderRemoval === 'trash' ? 'הספרים שלה עוברים לאשפה (ברירת מחדל)' : 'הספרים נשארים בספרייה'}>
          <div className="settings-seg">
            <button className={scan.folderRemoval === 'trash' ? 'active' : ''} onClick={() => setScanOption('folderRemoval', 'trash')}>
              לאשפה
            </button>
            <button className={scan.folderRemoval === 'keep' ? 'active' : ''} onClick={() => setScanOption('folderRemoval', 'keep')}>
              להשאיר
            </button>
          </div>
        </Row>
        <Row
          label={scanStatus ? 'סורק את הספרייה…' : 'סרוק את הספרייה עכשיו'}
          desc="קבצים חדשים בתיקיות נכנסים, קבצים שנמחקו יורדים מהרשימה"
          value={`${folderCount} תיקיות`}
          onClick={scanStatus ? undefined : () => rescanLibrary()}
        />
      </Section>

      <Section title="פתיחת ספרים מ-Windows">
        <Row
          label={appInfo.desktop ? 'פתח את הגדרות ברירת המחדל של Windows' : 'זמין רק באפליקציה המותקנת'}
          desc={appInfo.desktop
            ? 'Windows מחייב לבחור את האפליקציה ידנית: Win+I ← אפליקציות ← אפליקציות ברירת מחדל ← בחר לפי סוג קובץ ← epub'
            : 'בגרסת הדפדפן אין שיוך קבצים'}
          onClick={appInfo.desktop ? async () => {
            const ok = await openDefaultApps();
            if (!ok) toast('לא ניתן לפתוח את הגדרות Windows', 'error');
          } : undefined}
        />
        <Row
          label="סוגי קבצים שהאפליקציה נרשמת אליהם"
          desc={appInfo.desktop
            ? 'בהתקנה נרשמים epub · fb2 · mobi · azw3 · pdf, כדי שיופיעו ברשימת „פתח עם“'
            : 'בהתקנה נרשמים epub · fb2 · mobi · azw3 · pdf'}
        />
        <Row
          label="פתיחת קובץ בלחיצה כפולה"
          desc="קובץ שנפתח דרך האפליקציה נכנס לספרייה ונפתח לקריאה"
          value={appInfo.desktop ? 'פעיל' : '—'}
        />
      </Section>

      <Section title="מראה">
        <Row label="ערכת נושא של הממשק" desc="צבע החלונות והתפריטים">
          <div className="settings-seg">
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>כהה</button>
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>בהיר</button>
          </div>
        </Row>
      </Section>

      <Section title="אחסון ומיקום">
        <Row
          label="תיקיית הנתונים"
          desc={appInfo.desktop ? appInfo.userData : 'בדפדפן הספרייה נשמרת בזיכרון המקומי'}
          value={appInfo.desktop ? (appInfo.portable ? 'נייד' : 'מותקן') : 'דפדפן'}
          onClick={appInfo.desktop && window.shoso?.openDataFolder ? () => window.shoso.openDataFolder() : undefined}
        />
        <Row
          label="הקבצים לא מועתקים"
          desc="הספרייה מצביעה על הספרים במקומם – הסרה מהספרייה או לאשפה לא מוחקת קובץ מהמחשב"
        />
        <Row
          label="הסרת תיקייה"
          desc="מסירה מהספרייה את הספרים שבאו ממנה ומעבירה אותם לאשפה, משם אפשר לשחזר"
        />
        {!appInfo.desktop && (
          <Row
            label={loadingDemo ? 'טוען…' : 'טען ספרי דמו'}
            desc="EPUB · FB2 · TXT · MD · HTML – רק בתצוגת הדפדפן"
            onClick={loadingDemo ? undefined : loadDemo}
          />
        )}
      </Section>

      <Section title="אודות ועדכונים">
        <Row label="SHOSO Books" desc="קורא ספרים אלקטרוניים למחשב" value={`גרסה ${appInfo.version}`} />
        <Row
          label="עדכונים"
          desc={updates.status === 'checking'
            ? 'פונה ל-GitHub…'
            : `${sinceLabel(updates.checkedAt)} · בדיקה מול GitHub`}
          value={updateStatusLine(updates, appInfo.version)}
          onClick={updates.status === 'checking' ? undefined : () => checkForUpdate(true)}
        />
        {updates.status === 'available' && (
          <Row
            label={`הורד את גרסה ${updates.latest}`}
            desc="נפתח בדפדפן – מתקינים מעל הגרסה הקיימת והספרייה נשמרת"
            onClick={() => downloadUpdate()}
          />
        )}
        <Row label="בדיקת עדכונים אוטומטית" desc="פעם ביומיים, ברקע, בלי להפריע">
          <Switch checked={updates.autoCheck !== false} onChange={(v) => setUpdatesOption('autoCheck', v)} />
        </Row>
        <Row label="עובד לגמרי אופליין" desc="הספרים, הספרייה וההגדרות נשארים במחשב – רק בדיקת העדכונים יוצאת לרשת" />
        <Row label="פורמטים נתמכים" desc="EPUB · PDF · FB2 · TXT · DOCX · MD" />
        <Row label="מצב הרצה" desc="אפליקציית שולחן עבודה" value={appInfo.desktop ? 'Windows' : 'דפדפן'} />
        <Row label="פרטיות" desc="הכל נשאר על המחשב שלך" />
      </Section>
    </div>
  );
}
