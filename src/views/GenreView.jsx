import React, { useState } from 'react';
import { useStore, genres, playQueue } from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import TrackList from '../components/TrackList.jsx';
import { IconPlay } from '../lib/icons.jsx';

export default function GenreView() {
  const list = useStore(() => genres());
  const [selected, setSelected] = useState(null);
  const active = list.find((g) => g.name === selected);

  if (active) {
    return (
      <div className="view">
        <div className="view-head">
          <div>
            <button className="link back" onClick={() => setSelected(null)}>→ כל הז׳אנרים</button>
            <h2 className="view-title">{active.name}</h2>
            <p className="view-sub">{active.tracks.length} שירים</p>
          </div>
          <button className="btn primary" onClick={() => playQueue(active.tracks.map((t) => t.id), 0)}>
            <IconPlay size={16} /> נגן ז׳אנר
          </button>
        </div>
        <TrackList tracks={active.tracks} />
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">ז׳אנרים</h2>
          <p className="view-sub">{list.length} ז׳אנרים</p>
        </div>
      </div>
      <div className="genre-grid">
        {list.map((genre) => (
          <button key={genre.name} className="genre-tile" onClick={() => setSelected(genre.name)}>
            <Cover src={genre.picture} name={genre.name} size="100%" rounded={14} className="genre-bg" />
            <span className="genre-name">{genre.name}</span>
            <span className="genre-count">{genre.tracks.length} שירים</span>
          </button>
        ))}
      </div>
      {!list.length && <div className="empty-state"><p>אין ז׳אנרים בספרייה</p></div>}
    </div>
  );
}
