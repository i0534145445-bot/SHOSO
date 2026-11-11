import React, { useEffect, useMemo, useState } from 'react';
import {
  useStore, setView, playQueue, renamePlaylist, deletePlaylist, tracksForPlaylist,
  addToPlaylist, removeFromPlaylist, reorderPlaylist,
} from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import TrackList from '../components/TrackList.jsx';
import TrackRow from '../components/TrackRow.jsx';
import { IconPlay, IconShuffle, IconTrash, IconPlus, IconSearch } from '../lib/icons.jsx';
import { formatTime, matchesQuery, trackHaystack } from '../lib/format.js';

export default function PlaylistDetail() {
  const playlists = useStore((s) => s.playlists);
  const allTracks = useStore((s) => s.tracks);
  const [id, setId] = useState(() => window.__shosoSelectedPlaylist || null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    const onOpen = (event) => setId(event.detail);
    window.addEventListener('shoso:open-playlist', onOpen);
    return () => {
      window.removeEventListener('shoso:open-playlist', onOpen);
    };
  }, []);

  const playlist = useMemo(() => playlists.find((p) => p.id === id) || playlists[0], [playlists, id]);
  const tracks = useMemo(() => (playlist ? tracksForPlaylist(playlist) : []), [playlist, allTracks]);
  const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

  if (!playlist) {
    return (
      <div className="empty-state">
        <p>הפלייליסט לא נמצא.</p>
        <button className="btn ghost" onClick={() => setView('playlists')}>חזרה לפלייליסטים</button>
      </div>
    );
  }

  const candidates = addQuery
    ? allTracks
        .filter((t) => !playlist.trackIds.includes(t.id) && matchesQuery(trackHaystack(t), addQuery))
        .slice(0, 40)
    : [];

  const startEdit = () => {
    setName(playlist.name);
    setEditing(true);
  };

  const commitEdit = () => {
    if (name.trim()) renamePlaylist(playlist.id, name.trim());
    setEditing(false);
  };

  return (
    <div className="view">
      <section className="detail-hero">
        <Cover src={tracks[0]?.picture} name={playlist.name} size={220} rounded={18} className="detail-cover" />
        <div className="detail-info">
          <span className="eyebrow">פלייליסט</span>
          {editing ? (
            <input
              className="title-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : (
            <h2 onDoubleClick={startEdit} title="לחץ פעמיים לשינוי שם">{playlist.name}</h2>
          )}
          <p className="detail-meta">
            {tracks.length} שירים · {formatTime(total, { hours: true })}
          </p>
          <div className="detail-actions">
            <button className="btn primary large" disabled={!tracks.length} onClick={() => playQueue(tracks.map((t) => t.id), 0)}>
              <IconPlay size={18} /> נגן
            </button>
            <button
              className="btn ghost large"
              disabled={!tracks.length}
              onClick={() => playQueue([...tracks.map((t) => t.id)].sort(() => Math.random() - 0.5), 0)}
            >
              <IconShuffle size={18} /> אקראי
            </button>
            <button className={`btn ghost large ${adding ? 'active' : ''}`} onClick={() => setAdding((v) => !v)}>
              <IconPlus size={18} /> הוסף שירים
            </button>
            <button className="btn ghost large" onClick={startEdit}>שנה שם</button>
            <button
              className="btn danger-ghost large"
              onClick={() => {
                if (window.confirm(`למחוק את הפלייליסט "${playlist.name}"?`)) {
                  deletePlaylist(playlist.id);
                  setView('playlists');
                }
              }}
            >
              <IconTrash size={18} /> מחק
            </button>
          </div>
        </div>
      </section>

      {adding && (
        <section className="add-panel">
          <div className="search small">
            <IconSearch size={16} />
            <input
              autoFocus
              value={addQuery}
              placeholder="חפש שיר להוספה…"
              onChange={(e) => setAddQuery(e.target.value)}
            />
          </div>
          <div className="add-list">
            {candidates.map((track) => (
              <button
                key={track.id}
                className="add-row"
                onClick={() => addToPlaylist(playlist.id, track.id)}
              >
                <Cover src={track.picture} name={track.album} size={34} rounded={6} />
                <span className="add-title">{track.title}</span>
                <span className="add-artist">{track.artist}</span>
                <IconPlus size={16} />
              </button>
            ))}
            {addQuery && !candidates.length && <p className="hint">לא נמצאו שירים</p>}
            {!addQuery && <p className="hint">הקלד לחיפוש, ולחץ על שיר כדי להוסיף אותו לפלייליסט.</p>}
          </div>
        </section>
      )}

      {tracks.length ? (
        <div className="playlist-tracks">
          <div className="list-toolbar">
            <button className="btn primary" onClick={() => playQueue(tracks.map((t) => t.id), 0)}>
              <IconPlay size={16} /> נגן הכל
            </button>
            <span className="toolbar-meta">גרור שורות כדי לשנות סדר</span>
          </div>
          <div className="track-body">
            {tracks.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex == null || dragIndex === index) return;
                  reorderPlaylist(playlist.id, dragIndex, index);
                  setDragIndex(null);
                }}
                className={`playlist-row ${dragIndex === index ? 'dragging' : ''}`}
              >
                <span className="drag-handle" title="גרור לשינוי סדר">⋮⋮</span>
                <TrackRow track={track} index={index} queue={tracks.map((t) => t.id)} showAlbum />
                <button
                  className="icon-btn tiny remove"
                  title="הסר מהפלייליסט"
                  onClick={() => removeFromPlaylist(playlist.id, track.id)}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>הפלייליסט ריק – הוסף שירים כדי להתחיל.</p>
          <button className="btn primary" onClick={() => setAdding(true)}><IconPlus size={16} /> הוסף שירים</button>
        </div>
      )}
    </div>
  );
}
