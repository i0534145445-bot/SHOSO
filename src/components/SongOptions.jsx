import React, { useEffect, useRef } from 'react';
import {
  useStore, playTrack, playNext, addToQueue, toggleFavorite, isFavorite,
  addToPlaylist, createPlaylist, removeFromPlaylist, openPlaylist,
} from '../lib/store.js';
import { revealInExplorer } from '../lib/platform.js';

/**
 * Floating context menu for a track. `extra` lets parent views add actions
 * (e.g. "remove from playlist").
 */
export default function SongOptions({ track, position, onClose, playlistId = null, extra = [] }) {
  const ref = useRef(null);
  const playlists = useStore((s) => s.playlists);
  const fav = useStore(() => isFavorite(track.id));

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const style = {
    left: Math.min(position.x, (window.innerWidth || 1200) - 260),
    top: Math.min(position.y, (window.innerHeight || 800) - 320),
  };

  const run = (fn) => () => {
    fn();
    onClose?.();
  };

  return (
    <div className="context-menu" ref={ref} style={style} onClick={(e) => e.stopPropagation()}>
      <div className="context-head" title={track.title}>{track.title}</div>
      <button className="menu-item" onClick={run(() => playTrack(track))}>נגן עכשיו</button>
      <button className="menu-item" onClick={run(() => playNext(track.id))}>נגן בהמשך</button>
      <button className="menu-item" onClick={run(() => addToQueue(track.id))}>הוסף לתור</button>
      <button className="menu-item" onClick={run(() => toggleFavorite(track.id))}>
        {fav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
      </button>
      <div className="menu-sep" />
      <div className="menu-label">הוסף לפלייליסט</div>
      <button
        className="menu-item"
        onClick={run(() => {
          const playlist = createPlaylist('פלייליסט חדש', [track.id]);
          openPlaylist(playlist.id);
        })}
      >
        + פלייליסט חדש
      </button>
      {playlists.map((playlist) => (
        <button key={playlist.id} className="menu-item subtle" onClick={run(() => addToPlaylist(playlist.id, track.id))}>
          {playlist.name}
        </button>
      ))}
      {extra.map((action) => (
        <button key={action.label} className="menu-item" onClick={run(action.onClick)}>
          {action.label}
        </button>
      ))}
      {playlistId && (
        <>
          <div className="menu-sep" />
          <button className="menu-item danger" onClick={run(() => removeFromPlaylist(playlistId, track.id))}>
            הסר מהפלייליסט
          </button>
        </>
      )}
      {track.path && !track.path.startsWith('blob:') && (
        <>
          <div className="menu-sep" />
          <button className="menu-item" onClick={run(() => revealInExplorer(track.path))}>
            הצג בתיקייה
          </button>
        </>
      )}
      <div className="menu-sep" />
      <div className="menu-meta">
        {[track.codec, track.bitrate ? `${Math.round(track.bitrate / 1000)}kbps` : null, track.sampleRate ? `${track.sampleRate}Hz` : null]
          .filter(Boolean)
          .join(' · ')}
      </div>
    </div>
  );
}
