import React, { useEffect, useMemo, useState } from 'react';
import { useStore, artists, playQueue, setView, openAlbum } from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import TrackList from '../components/TrackList.jsx';
import { IconPlay, IconShuffle } from '../lib/icons.jsx';
import { normalize, formatTime } from '../lib/format.js';

const albumKeyOf = (track) => `${track.albumArtist || track.artist}||${track.album}`;

export default function ArtistDetail() {
  const artistList = useStore(() => artists());
  const [target, setTarget] = useState(() => window.__shosoArtist || null);

  useEffect(() => {
    const onOpen = (event) => setTarget(event.detail);
    window.addEventListener('shoso:open-artist', onOpen);
    return () => window.removeEventListener('shoso:open-artist', onOpen);
  }, []);

  const artist = useMemo(
    () => artistList.find((a) => normalize(a.name) === normalize(target)) || null,
    [artistList, target],
  );

  const albums = useMemo(() => {
    if (!artist) return [];
    const map = new Map();
    for (const track of artist.tracks) {
      const key = albumKeyOf(track);
      if (!map.has(key)) map.set(key, { key, album: track.album, year: track.year, picture: track.picture, tracks: [] });
      map.get(key).tracks.push(track);
    }
    return [...map.values()];
  }, [artist]);

  if (!artist) {
    return (
      <div className="empty-state">
        <p>האמן לא נמצא.</p>
        <button className="btn ghost" onClick={() => setView('artists')}>חזרה לאמנים</button>
      </div>
    );
  }

  const ids = artist.tracks.map((t) => t.id);
  const topTracks = [...artist.tracks].sort((a, b) => (b.duration || 0) - (a.duration || 0)).slice(0, 5);

  return (
    <div className="view">
      <section className="detail-hero artist-hero">
        <Cover src={artist.picture} name={artist.name} size={200} rounded={999} className="detail-cover round" />
        <div className="detail-info">
          <span className="eyebrow">אמן</span>
          <h2>{artist.name}</h2>
          <p className="detail-meta">
            {artist.tracks.length} שירים · {artist.albumCount} אלבומים · {formatTime(artist.duration, { hours: true })}
          </p>
          <div className="detail-actions">
            <button className="btn primary large" onClick={() => playQueue(ids, 0)}>
              <IconPlay size={18} /> נגן
            </button>
            <button
              className="btn ghost large"
              onClick={() => playQueue([...ids].sort(() => Math.random() - 0.5), 0)}
            >
              <IconShuffle size={18} /> אקראי
            </button>
          </div>
        </div>
      </section>

      <section className="shelf">
        <div className="shelf-head"><h3>אלבומים</h3></div>
        <div className="card-grid">
          {albums.map((album) => (
            <button
              key={album.key}
              className="card"
              onClick={() => openAlbum({ album: album.album, artist: artist.name })}
            >
              <Cover src={album.picture} name={album.album} size={168} rounded={14} />
              <div className="card-title">{album.album}</div>
              <div className="card-sub">{album.tracks.length} שירים</div>
            </button>
          ))}
        </div>
      </section>

      <section className="shelf">
        <div className="shelf-head"><h3>שירים מובילים</h3></div>
        <div className="top-list">
          {topTracks.map((track, i) => (
            <button key={track.id} className="top-row" onClick={() => playQueue(ids, ids.indexOf(track.id))}>
              <span className="top-rank">{i + 1}</span>
              <Cover src={track.picture} name={track.album} size={44} rounded={8} />
              <span className="top-title">{track.title}</span>
              <span className="top-artist">{track.album}</span>
            </button>
          ))}
        </div>
      </section>

      <TrackList tracks={artist.tracks} showCover={false} />
    </div>
  );
}
