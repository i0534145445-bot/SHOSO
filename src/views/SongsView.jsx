import React, { useMemo, useState } from 'react';
import { useStore, filteredTracks, sortTracks, recentTracks, mostPlayed, importFolders, playTrack, loadDemoLibrary } from '../lib/store.js';
import TrackList from '../components/TrackList.jsx';
import Cover from '../components/Cover.jsx';
import { IconFolder, IconSparkle } from '../lib/icons.jsx';
import { formatTime } from '../lib/format.js';

export default function SongsView() {
  const tracks = useStore((s) => s.tracks);
  const view = useStore((s) => s.view);
  const query = useStore((s) => s.query);
  const sort = useStore((s) => s.sort);
  const recent = useStore(() => recentTracks(12));
  const top = useStore(() => mostPlayed(8));

  const visible = useMemo(() => sortTracks(filteredTracks(tracks, query), sort), [tracks, query, sort]);
  const [showRecent, setShowRecent] = useState(true);

  if (!tracks.length) {
    return (
      <div className="view empty-library">
        <div className="empty-hero">
          <div className="empty-art">
            <IconSparkle size={44} />
          </div>
          <h2>הספרייה שלך ריקה</h2>
          <p>הוסף תיקיית מוזיקה מהמחשב או גרור קבצים לחלון – SHOSO יקרא את כל התגים והעטיפות אוטומטית.</p>
          <div className="hero-actions">
            <button className="btn primary large" onClick={() => importFolders()}>
              <IconFolder size={18} /> בחר תיקיית מוזיקה
            </button>
            <button className="btn ghost large" onClick={() => loadDemoLibrary()}>מוזיקת דמו</button>
          </div>
          <p className="hint">נתמכים: MP3, FLAC, M4A/AAC, WAV, OGG/Opus, WMA, AIFF</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">כל השירים</h2>
          <p className="view-sub">
            {visible.length} מתוך {tracks.length} שירים · {formatTime(visible.reduce((s, t) => s + (t.duration || 0), 0), { hours: true })}
          </p>
        </div>
      </div>

      {!query && showRecent && recent.length > 0 && (
        <section className="shelf">
          <div className="shelf-head">
            <h3>השמעות אחרונות</h3>
            <button className="link" onClick={() => setShowRecent(false)}>הסתר</button>
          </div>
          <div className="shelf-row">
            {recent.map((track) => (
              <button
                key={track.id}
                className="mini-card"
                onClick={() => playTrack(track, { queue: recent.map((t) => t.id) })}
                title={track.title}
              >
                <Cover src={track.picture} name={track.album} size={104} rounded={12} />
                <div className="mini-title">{track.title}</div>
                <div className="mini-sub">{track.artist}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <TrackList tracks={visible} emptyMessage="לא נמצאו שירים לחיפוש הזה" />
    </div>
  );
}
