import React from 'react';
import { useStore, setEqBand, applyEq, toggleEq, setPreamp, setEqPreset } from '../lib/store.js';
import { EQ_FREQUENCIES, EQ_PRESETS } from '../lib/audio.js';

const label = (freq) => (freq >= 1000 ? `${freq / 1000}k` : String(freq));

export default function Equalizer() {
  const gains = useStore((s) => s.eqGains);
  const enabled = useStore((s) => s.eqEnabled);
  const preamp = useStore((s) => s.preamp);
  const preset = useStore((s) => s.eqPreset);

  return (
    <div className={`equalizer ${enabled ? '' : 'disabled'}`}>
      <div className="eq-head">
        <div>
          <h3>אקולייזר 10 ערוצים</h3>
          <p className="hint">כוונן את הספקטרום; הפריסטים משנים את כל הרצועות בבת אחת.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={enabled} onChange={toggleEq} />
          <span className="slider" />
          <span className="switch-label">{enabled ? 'פעיל' : 'כבוי'}</span>
        </label>
      </div>

      <div className="preset-row">
        {Object.keys(EQ_PRESETS).map((name) => (
          <button
            key={name}
            className={`chip ${preset === name ? 'active' : ''}`}
            onClick={() => setEqPreset(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="eq-body" dir="ltr">
        <div className="eq-band">
          <span className="eq-value">{preamp > 0 ? `+${preamp}` : preamp}dB</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={preamp}
            onChange={(e) => setPreamp(Number(e.target.value))}
            className="vertical"
            aria-label="קדם-הגברה"
          />
          <span className="eq-label">PRE</span>
        </div>
        {EQ_FREQUENCIES.map((freq, index) => (
          <div className="eq-band" key={freq}>
            <span className="eq-value">{gains[index] > 0 ? `+${gains[index]}` : gains[index]}</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={gains[index]}
              onChange={(e) => setEqBand(index, Number(e.target.value))}
              className="vertical"
              aria-label={`${freq} הרץ`}
            />
            <span className="eq-label">{label(freq)}</span>
          </div>
        ))}
      </div>

      <div className="eq-foot">
        <button className="btn ghost small" onClick={() => applyEq({ eqGains: EQ_FREQUENCIES.map(() => 0), eqPreset: 'שטוח' })}>
          איפוס לשטוח
        </button>
        <button className="btn ghost small" onClick={() => setEqPreset('מוגבר לקשישים')}>
          פריסט להגברת דיבור
        </button>
      </div>
    </div>
  );
}
