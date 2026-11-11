import React, { useState } from 'react';
import {
  playTrack, useStore, isFavorite, toggleFavorite, currentTrack, openArtist, openAlbum,
} from '../lib/store.js';
import { formatTime } from '../lib/format.js';
import SongOptions from './SongOptions.jsx';
import Cover from './Cover.jsx';

export default function TrackRow({
  track,
  index,
  queue,
  showAlbum = true,
  showCover = true,
  onPlay,
  compact = false,
  current,
}) {
  const isFav = useStore(() => isFavorite(track.id));
  const playing = useStore((s) => s.playing);
  const isCurrent = useStore(() => currentTrack()?.id === track.id);
  const active = current ?? isCurrent;
  const [menuPos, setMenuPos] = useState(null);

  const handlePlay = (event) => {
    event?.stopPropagation?.();
    playTrack(track, { queue });
    onPlay?.(track);
  };

  return (
    <div
      className={`track-row ${active ? 'active' : ''} ${compact ? 'compact' : ''} ${!showCover ? 'no-cover' : ''} ${!showAlbum ? 'no-album' : ''}`}
      onDoubleClick={handlePlay}
      onClick={(e) => { if (e.detail === 1) return; }}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handlePlay(e);
      }}
    >
      <div className="cell index">
        <span className="index-num">{index + 1}</span>
        <button className="row-play" onClick={handlePlay} title={active && playing ? 'מתנגן' : 'נגן'}>
          {active && playing ? (
            <span className="playing-bars"><i /><i /><i /></span>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13l11-6.5Z" /></svg>
          )}
        </button>
      </div>

      {showCover && (
        <div className="cell art">
          <Cover src={track.picture} name={track.album} size={40} rounded={8} />
        </div>
      )}

      <div className="cell title">
        <div className="title-main" title={track.title}>{track.title}</div>
        <div className="title-sub" title={track.artist}>
          <button className="link" onClick={(e) => { e.stopPropagation(); openArtist(track.artist); }}>
            {track.artist}
          </button>
          {track.year ? <span className="dim"> · {track.year}</span> : null}
        </div>
      </div>

      <div className="cell album">
        {showAlbum && track.album ? (
          <button
            className="link ellipsis"
            title={track.album}
            onClick={(e) => { e.stopPropagation(); openAlbum({ album: track.album, artist: track.albumArtist || track.artist }); }}
          >
            {track.album}
          </button>
        ) : (
          <span className="dim">—</span>
        )}
      </div>

      <div className="cell badge-cell">
        {track.codec ? <span className={`codec-badge ${String(track.codec).toLowerCase()}`}>{String(track.codec).replace(/^.*\//, '').toUpperCase()}</span> : null}
      </div>

      <div className="cell duration">{formatTime(track.duration)}</div>

      <div className="cell actions">
        <button
          className={`icon-btn tiny heart ${isFav ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }}
          title="מועדפים"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 3.1C19.5 15.4 12 20 12 20Z" />
          </svg>
        </button>
        <button
          className="icon-btn tiny"
          title="עוד אפשרויות"
          onClick={(e) => {
            e.stopPropagation();
            setMenuPos({ x: e.clientX, y: e.clientY });
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <circle cx="12" cy="5.5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="18.5" r="1.7" />
          </svg>
        </button>
      </div>

      {menuPos && (
        <SongOptions
          track={track}
          position={menuPos}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  );
}
