import React, { useMemo } from 'react';
import {
  useStore, albums, artists, recentTracks, mostPlayed, playTrack, playQueue,
  importFolders, setView, loadDemoLibrary, openAlbum, openPlaylist,
} from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import { IconPlay, IconFolder, IconSparkle, IconHeart } from '../lib/icons.jsx';
import { formatTime } from '../lib/format.js';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 5) return 'לילה טוב';
  if (hour < 12) return 'בוקר טוב';
  if (hour < 17) return 'צהריים טובים';
  if (hour < 21) return 'ערב טוב';
  return 'לילה טוב';
};

export default function HomeView() {
  const tracks = useStore((s) => s.tracks);
  const albumList = useStore(() => albums());
  const artistList = useStore(() => artists());
  const recent = useStore(() => recentTracks(18));
  const top = useStore(() => mostPlayed(10));
  const favorites = useStore((s) => s.favorites);
  const playlists = useStore((s) => s.playlists);

  const totalDuration = useMemo(() => tracks.reduce((sum, t) => sum + (t.duration || 0), 0), [tracks]);
  const heroTracks = recent.length ? recent : tracks.slice(0, 8);

  if (!tracks.length) {
    return (
      <div className="view empty-library">
        <div className="empty-hero">
          <div className="empty-art"><IconSparkle size={46} /></div>
          <h2>ברוכים הבאים ל-SHOSO Music</h2>
          <p>
            נגן מוזיקה שולחני לווינדוס – ספרייה מהירה, עטיפות, מילים מסונכרנות, אקולייזר 10 ערוצים,
            פלייליסטים ותור נגינה. מתחילים בהוספת תיקייה.
          </p>
          <div className="hero-actions">
            <button className="btn primary large" onClick={() => importFolders()}>
              <IconFolder size={18} /> בחר תיקיית מוזיקה
            </button>
            <button className="btn ghost large" onClick={() => loadDemoLibrary()}>
              נסה עם מוזיקת דמו
            </button>
          </div>
          <div className="empty-features">
            <div><strong>חיפוש מיידי</strong><span>עברית, אנגלית וניקוד</span></div>
            <div><strong>אקולייזר</strong><span>10 רצועות + פריסטים</span></div>
            <div><strong>מילים</strong><span>LRC מסונכרן</span></div>
            <div><strong>תור חכם</strong><span>אקראי, חזרה, דירוג</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view home">
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">{greeting()}</span>
          <h2>מוכן לשמוע?</h2>
          <p>
            {tracks.length} שירים · {albumList.length} אלבומים · {artistList.length} אמנים ·{' '}
            {formatTime(totalDuration, { hours: true })} של מוזיקה
          </p>
          <div className="hero-actions">
            <button className="btn primary large" onClick={() => playQueue(heroTracks.map((t) => t.id), 0)}>
              <IconPlay size={18} /> נגן את המיקס שלי
            </button>
            <button className="btn ghost large" onClick={() => importFolders()}>
              <IconFolder size={18} /> הוסף מוזיקה
            </button>
          </div>
        </div>
        <div className="hero-covers">
          {albumList.slice(0, 4).map((album, i) => (
            <button key={album.key} className={`hero-cover c${i}`} onClick={() => openAlbum(album)} title={album.album}>
              <Cover src={album.picture} name={album.album} size={148} rounded={16} />
            </button>
          ))}
        </div>
      </section>

      {playlists.length > 0 && (
        <section className="shelf">
          <div className="shelf-head">
            <h3>הפלייליסטים שלך</h3>
            <button className="link" onClick={() => setView('playlists')}>הצג הכל</button>
          </div>
          <div className="card-grid">
            {playlists.slice(0, 6).map((playlist) => {
              const first = playlist.trackIds.length ? tracks.find((t) => t.id === playlist.trackIds[0]) : null;
              return (
                <button
                  key={playlist.id}
                  className="card"
                  onClick={() => openPlaylist(playlist.id)}
                >
                  <Cover src={first?.picture} name={playlist.name} size={168} rounded={14} />
                  <div className="card-title">{playlist.name}</div>
                  <div className="card-sub">{playlist.trackIds.length} שירים</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="shelf">
        <div className="shelf-head">
          <h3>האזנת לאחרונה</h3>
          <button className="link" onClick={() => setView('history')}>היסטוריה</button>
        </div>
        <div className="card-grid">
          {recent.slice(0, 8).map((track) => (
            <button
              key={track.id}
              className="card"
              onClick={() => playTrack(track, { queue: recent.map((t) => t.id) })}
              title={`${track.title} – ${track.artist}`}
            >
              <Cover src={track.picture} name={track.album} size={168} rounded={14} />
              <div className="card-title">{track.title}</div>
              <div className="card-sub">{track.artist}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="shelf">
        <div className="shelf-head">
          <h3>אלבומים</h3>
          <button className="link" onClick={() => setView('albums')}>הצג הכל</button>
        </div>
        <div className="card-grid">
          {albumList.slice(0, 8).map((album) => (
            <button key={album.key} className="card" onClick={() => openAlbum(album)}>
              <Cover src={album.picture} name={album.album} size={168} rounded={14} />
              <div className="card-title">{album.album}</div>
              <div className="card-sub">{album.artist}</div>
            </button>
          ))}
        </div>
      </section>

      {top.length > 0 && (
        <section className="shelf">
          <div className="shelf-head">
            <h3>הכי מושמעים</h3>
          </div>
          <div className="top-list">
            {top.map(({ track, count }, i) => (
              <button
                key={track.id}
                className="top-row"
                onClick={() => playTrack(track, { queue: top.map((t) => t.track.id) })}
              >
                <span className="top-rank">{i + 1}</span>
                <Cover src={track.picture} name={track.album} size={44} rounded={8} />
                <span className="top-title">{track.title}</span>
                <span className="top-artist">{track.artist}</span>
                <span className="top-count">{count} השמעות</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
