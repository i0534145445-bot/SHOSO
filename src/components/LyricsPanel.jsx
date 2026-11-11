import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, currentTrack, seekTo, toggleLyrics } from '../lib/store.js';
import { readLyrics } from '../lib/platform.js';
import { parseLrc, activeLineIndex } from '../lib/lrc.js';
import { IconClose, IconMicrophone } from '../lib/icons.jsx';
import Cover from './Cover.jsx';

export default function LyricsPanel() {
  const track = useStore(() => currentTrack());
  const time = useStore((s) => s.time);
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!track) {
      setLyrics(null);
      return () => { cancelled = true; };
    }
    setLoading(true);
    readLyrics(track)
      .then((result) => {
        if (cancelled) return;
        if (!result) setLyrics(null);
        else setLyrics(parseLrc(result.text || ''));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [track?.id]);

  const lines = lyrics?.lines || [];
  const active = useMemo(
    () => (lyrics?.isSynced ? activeLineIndex(lines, time) : -1),
    [lines, time, lyrics?.isSynced],
  );

  useEffect(() => {
    if (activeRef.current && activeRef.current.scrollIntoView) {
      activeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [active]);

  const hasLyrics = lines.length > 0;

  return (
    <aside className="lyrics-panel">
      <div className="lyrics-head">
        <h2>מילות השיר</h2>
        <button className="icon-btn" onClick={toggleLyrics} title="סגור">
          <IconClose />
        </button>
      </div>

      {track ? (
        <div className="lyrics-track">
          <Cover src={track.picture} name={track.album} size={64} rounded={12} />
          <div>
            <div className="lyrics-title">{track.title}</div>
            <div className="lyrics-artist">{track.artist}</div>
          </div>
        </div>
      ) : null}

      <div className="lyrics-body" ref={listRef}>
        {loading && <p className="lyrics-empty">טוען מילים…</p>}

        {!loading && !hasLyrics && (
          <div className="lyrics-empty">
            <IconMicrophone size={34} />
            <p>לא נמצאו מילים לשיר הזה.</p>
            <p className="hint">
              שים קובץ <code>.lrc</code> עם אותו שם של קובץ השיר (או תג מילים ב-ID3) והוא יוצג כאן עם סנכרון אוטומטי.
            </p>
          </div>
        )}

        {!loading && hasLyrics && !lyrics.isSynced && (
          <div className="lyrics-unsynced">
            {lines.map((line, i) => (
              <p key={i} className="lyric-line static">{line.text}</p>
            ))}
          </div>
        )}

        {!loading && hasLyrics && lyrics.isSynced && (
          <div className="lyrics-synced">
            {lines.map((line, i) => (
              <button
                key={i}
                ref={i === active ? activeRef : null}
                className={`lyric-line ${i === active ? 'active' : ''} ${i < active ? 'past' : ''}`}
                onClick={() => line.time != null && seekTo(line.time)}
              >
                {line.text || '♪'}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
