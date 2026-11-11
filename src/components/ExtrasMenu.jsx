import React, { useEffect, useState } from 'react';
import {
  useStore, setABPoint, clearABRepeat, setSleepTimer, sleepRemaining,
} from '../lib/store.js';
import { IconMore, IconClock } from '../lib/icons.jsx';

const SLEEP_OPTIONS = [15, 30, 45, 60, 90];

const clock = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Player extras: A-B loop and sleep timer. */
export default function ExtrasMenu() {
  const ab = useStore((s) => s.abRepeat);
  const sleep = useStore((s) => s.sleepTimer);
  const [open, setOpen] = useState(false);
  const [, forceTick] = useState(0);

  const abActive = ab.a != null && ab.b != null;

  useEffect(() => {
    if (!sleep) return undefined;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sleep]);

  return (
    <div className="popover-wrap">
      <button
        className={`icon-btn ${abActive || sleep ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="חזרה A-B וטיימר שינה"
      >
        <IconClock />
        {abActive && <span className="mini-flag">A-B</span>}
      </button>

      {open && (
        <div className="popover" onMouseLeave={() => setOpen(false)} style={{ minWidth: 260 }}>
          <div className="popover-title">חזרה A-B</div>
          <div className="ab-row">
            <button className={`chip ${ab.a != null ? 'active' : ''}`} onClick={() => setABPoint('a')}>
              קבע A
            </button>
            <button className={`chip ${ab.b != null ? 'active' : ''}`} onClick={() => setABPoint('b')}>
              קבע B
            </button>
            <button className="chip" onClick={() => clearABRepeat()} disabled={!ab.a && !ab.b}>
              נקה
            </button>
          </div>
          <p className="popover-hint">
            {abActive
              ? `חזרה בין ${ab.a.toFixed(1)}s ל־${ab.b.toFixed(1)}s`
              : 'סמן שתי נקודות כדי לחזור על קטע – שימושי לתרגול שפה או סולו.'}
          </p>

          <div className="menu-sep" />
          <div className="popover-title">טיימר שינה</div>
          <div className="chip-row">
            {SLEEP_OPTIONS.map((minutes) => (
              <button key={minutes} className="chip" onClick={() => setSleepTimer(minutes)}>
                {minutes}′
              </button>
            ))}
            {sleep && (
              <button className="chip active" onClick={() => setSleepTimer(null)}>
                בטל ({clock(sleepRemaining())})
              </button>
            )}
          </div>
          {sleep && <p className="popover-hint">הנגן יושהה בעוד {clock(sleepRemaining())}.</p>}
        </div>
      )}
    </div>
  );
}
