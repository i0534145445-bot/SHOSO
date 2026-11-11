import React, { useEffect, useMemo, useState } from 'react';
import { useStore, albums, playQueue, setView, createPlaylist, openAlbum, openArtist } from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import TrackList from '../components/TrackList.jsx';
import { IconPlay, IconPlus, IconShuffle } from '../lib/icons.jsx';
import { formatTime } from '../lib/format.js';

export default function AlbumDetail() {
  const albumList = useStore(() => albums());
  const [target, setTarget] = useState(() => window.__shosoAlbum || null);

  useEffect(() => {
    const onOpen = (event) => setTarget(event.detail);
    window.addEventListener('shoso:open-album', onOpen);
    return () => window.removeEventListener('shoso:open-album', onOpen);
  }, []);


  const album = useMemo(() => {
    if (!target) return null;
    return (
      albumList.find((a) => a.album === target.album && (!target.artist || a.artist === target.artist)) ||
      albumList.find((a) => a.album === target.album) ||
      null
    );
  }, [albumList, target]);

  if (!album) {
    return (
      <div className="empty-state">
        <p>האלבום לא נמצא.</p>
        <button className="btn ghost" onClick={() => setView('albums')}>חזרה לאלבומים</button>
      </div>
    );
  }

  const ids = album.tracks.map((t) => t.id);

  return (
    <div className="view">
      <section className="detail-hero">
        <Cover src={album.picture} name={album.album} size={220} rounded={18} className="detail-cover" />
        <div className="detail-info">
          <span className="eyebrow">אלבום</span>
          <h2>{album.album}</h2>
          <button className="link big" onClick={() => openArtist(album.artist)}>
            {album.artist}
          </button>
          <p className="detail-meta">
            {album.tracks.length} שירים · {formatTime(album.duration, { hours: true })}
            {album.year ? ` · ${album.year}` : ''}
          </p>
          <div className="detail-actions">
            <button className="btn primary large" onClick={() => playQueue(ids, 0)}>
              <IconPlay size={18} /> נגן
            </button>
            <button
              className="btn ghost large"
              onClick={() => {
                const shuffled = [...ids].sort(() => Math.random() - 0.5);
                playQueue(shuffled, 0);
              }}
            >
              <IconShuffle size={18} /> אקראי
            </button>
            <button
              className="btn ghost large"
              onClick={() => createPlaylist(`${album.album} – ${album.artist}`, ids)}
            >
              <IconPlus size={18} /> שמור כפלייליסט
            </button>
          </div>
        </div>
      </section>

      <TrackList tracks={album.tracks} showAlbum={false} showCover={false} />
    </div>
  );
}
