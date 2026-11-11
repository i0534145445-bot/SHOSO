import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useStore, currentTrack, togglePlay, nextTrack, prevTrack, seekTo, setVolume,
  toggleMute, toggleShuffle, cycleRepeat, setRate, toggleLyrics, toggleFavorite,
  isFavorite, setView, addToQueue, addToPlaylist, createPlaylist, openAlbum, openPlaylist,
} from '../lib/store.js';
import {
  IconPlay, IconPause, IconNext, IconPrev, IconShuffle, IconRepeat, IconRepeatOne,
  IconVolume, IconMuted, IconLyrics, IconHeart, IconMore, IconGauge, IconQueue,
} from '../lib/icons.jsx';
import { formatTime } from '../lib/format.js';
import Cover from './Cover.jsx';
import Visualizer from './Visualizer.jsx';
import ExtrasMenu from './ExtrasMenu.jsx';

function ProgressBar({ time, duration, onSeek }) {
  const barRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [dragging, setDragging] = useState(false);

  const posFromEvent = useCallback((event) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return 0;
    // RTL-friendly: compute from the left edge of the element in LTR pixel terms.
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return ratio;
  }, []);

  const commit = useCallback(
    (ratio) => {
      if (duration > 0) onSeek(ratio * duration);
    },
    [duration, onSeek],
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const move = (e) => commit(posFromEvent(e));
    const up = (e) => {
      commit(posFromEvent(e));
      setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, commit, posFromEvent]);

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const hoverRatio = hover ?? progress;

  return (
    <div className="progress-wrap" dir="ltr">
      <span className="time">{formatTime(dragging && hover != null ? hoverRatio * duration : time)}</span>
      <div
        className={`progress ${dragging ? 'dragging' : ''}`}
        ref={barRef}
        onPointerDown={(e) => {
          if (duration <= 0) return;
          setDragging(true);
          commit(posFromEvent(e));
        }}
        onPointerMove={(e) => setHover(posFromEvent(e))}
        onPointerLeave={() => setHover(null)}
        role="slider"
        tabIndex={0}
        aria-label="מיקום בשיר"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
      >
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          <div className="progress-thumb" style={{ left: `${progress * 100}%` }} />
        </div>
      </div>
      <span className="time">{formatTime(duration)}</span>
    </div>
  );
}

function VolumeControl() {
  const volume = useStore((s) => s.volume);
  const muted = useStore((s) => s.muted);
  const [open, setOpen] = useState(false);
  const level = muted || volume === 0 ? 0 : volume > 0.55 ? 2 : 1;

  return (
    <div className="volume-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="icon-btn" onClick={toggleMute} title={muted ? 'בטל השתקה (M)' : 'השתק (M)'}>
        {muted || volume === 0 ? <IconMuted /> : <IconVolume level={level} />}
      </button>
      <div className={`volume-slider ${open ? 'open' : ''}`} dir="ltr">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="עוצמת שמע"
          style={{ '--fill': `${(muted ? 0 : volume) * 100}%` }}
        />
      </div>
      <span className="volume-value">{Math.round((muted ? 0 : volume) * 100)}%</span>
    </div>
  );
}

function RatePopover() {
  const rate = useStore((s) => s.rate);
  const [open, setOpen] = useState(false);
  const rates = [0.75, 0.9, 1, 1.1, 1.25, 1.5];
  return (
    <div className="popover-wrap">
      <button className={`icon-btn ${rate !== 1 ? 'active' : ''}`} onClick={() => setOpen((v) => !v)} title="מהירות נגינה">
        <IconGauge />
        {rate !== 1 && <span className="rate-chip">{rate.toFixed(2).replace(/0$/, '')}x</span>}
      </button>
      {open && (
        <div className="popover" onMouseLeave={() => setOpen(false)}>
          <div className="popover-title">מהירות נגינה</div>
          <div className="chip-row">
            {rates.map((value) => (
              <button
                key={value}
                className={`chip ${rate === value ? 'active' : ''}`}
                onClick={() => setRate(value)}
              >
                {value}x
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            dir="ltr"
          />
          <p className="popover-hint">הגובה נשמר (pitch lock) – מתאים ללימוד שפות.</p>
        </div>
      )}
    </div>
  );
}

function TrackMenu({ track }) {
  const [open, setOpen] = useState(false);
  const playlistList = useStore((s) => s.playlists);
  if (!track) return null;
  return (
    <div className="popover-wrap">
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} title="עוד">
        <IconMore />
      </button>
      {open && (
        <div className="popover menu" onMouseLeave={() => setOpen(false)}>
          <button className="menu-item" onClick={() => { addToQueue(track.id); setOpen(false); }}>
            הוסף לתור
          </button>
          <button className="menu-item" onClick={() => { toggleFavorite(track.id); setOpen(false); }}>
            {isFavorite(track.id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item"
            onClick={() => {
              const playlist = createPlaylist(`${track.title} – מיקס`, [track.id]);
              setOpen(false);
              openPlaylist(playlist.id);
            }}
          >
            צור פלייליסט מהשיר
          </button>
          {playlistList.map((playlist) => (
            <button
              key={playlist.id}
              className="menu-item subtle"
              onClick={() => { addToPlaylist(playlist.id, track.id); setOpen(false); }}
            >
              הוסף אל: {playlist.name}
            </button>
          ))}
          <div className="menu-sep" />
          <button
            className="menu-item"
            onClick={() => { window.shoso?.reveal?.(track.path); setOpen(false); }}
          >
            הצג בתיקייה
          </button>
        </div>
      )}
    </div>
  );
}

export default function PlayerBar() {
  const track = useStore(() => currentTrack());
  const playing = useStore((s) => s.playing);
  const time = useStore((s) => s.time);
  const duration = useStore((s) => s.duration);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const showLyrics = useStore((s) => s.showLyrics);
  const fav = useStore(() => (track ? isFavorite(track.id) : false));
  const queueLength = useStore((s) => s.queue.length);

  return (
    <footer className="player">
      <div className="player-left">
        <div
          className={`now-cover ${playing ? 'spinning' : ''}`}
          onClick={() => track && openAlbum({ album: track.album, artist: track.albumArtist || track.artist })}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && track && openAlbum({ album: track.album, artist: track.albumArtist || track.artist })}
          title={track ? 'פתח אלבום' : ''}
        >
          <Cover src={track?.picture} name={track?.album || 'SHOSO'} size={58} rounded={12} />
          <Visualizer size={58} />
        </div>
        <div className="now-meta">
          <div className="now-title" title={track?.title}>{track?.title || 'לא מתנגן שיר'}</div>
          <div className="now-artist" title={track?.artist}>{track?.artist || 'בחר שיר מהספרייה'}</div>
        </div>
        <button
          className={`icon-btn heart ${fav ? 'active' : ''}`}
          onClick={() => track && toggleFavorite(track.id)}
          disabled={!track}
          title="מועדפים"
        >
          <IconHeart filled={fav} />
        </button>
      </div>

      <div className="player-center">
        <div className="transport">
          <button className={`icon-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle} title="אקראי">
            <IconShuffle />
          </button>
          <button className="icon-btn" onClick={prevTrack} title="הקודם">
            <IconPrev size={22} />
          </button>
          <button className="play-btn" onClick={togglePlay} title={playing ? 'השהה (רווח)' : 'נגן (רווח)'}>
            {playing ? <IconPause size={24} /> : <IconPlay size={24} />}
          </button>
          <button className="icon-btn" onClick={() => nextTrack()} title="הבא">
            <IconNext size={22} />
          </button>
          <button
            className={`icon-btn ${repeat !== 'off' ? 'active' : ''}`}
            onClick={cycleRepeat}
            title={repeat === 'one' ? 'חזרה על שיר' : repeat === 'all' ? 'חזרה על הכל' : 'חזרה כבויה'}
          >
            {repeat === 'one' ? <IconRepeatOne /> : <IconRepeat />}
          </button>
        </div>
        <ProgressBar time={time} duration={duration} onSeek={seekTo} />
      </div>

      <div className="player-right">
        <ExtrasMenu />
        <RatePopover />
        <button className={`icon-btn ${showLyrics ? 'active' : ''}`} onClick={toggleLyrics} title="מילות השיר">
          <IconLyrics />
        </button>
        <button className={`icon-btn ${queueLength ? 'has-badge' : ''}`} onClick={() => setView('queue')} title="תור נגינה">
          <IconQueue />
          {queueLength > 0 && <span className="dot-badge">{queueLength}</span>}
        </button>
        <VolumeControl />
        <TrackMenu track={track} />
      </div>
    </footer>
  );
}
