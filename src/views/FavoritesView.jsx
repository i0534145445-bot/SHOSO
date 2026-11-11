import React, { useMemo } from 'react';
import { useStore, setView, createPlaylist } from '../lib/store.js';
import TrackList from '../components/TrackList.jsx';
import { IconHeart, IconPlus } from '../lib/icons.jsx';

export default function FavoritesView() {
  const favorites = useStore((s) => s.favorites);
  const tracks = useStore((s) => s.tracks);
  const favTracks = useMemo(
    () => favorites.map((id) => tracks.find((t) => t.id === id)).filter(Boolean),
    [favorites, tracks],
  );

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">מועדפים</h2>
          <p className="view-sub">{favTracks.length} שירים שאהבת</p>
        </div>
        {favTracks.length > 0 && (
          <button
            className="btn ghost"
            onClick={() => createPlaylist('המועדפים שלי', favTracks.map((t) => t.id))}
          >
            <IconPlus size={16} /> שמור כפלייליסט
          </button>
        )}
      </div>

      {favTracks.length ? (
        <TrackList tracks={favTracks} />
      ) : (
        <div className="empty-state">
          <IconHeart size={40} />
          <p>עוד לא סימנת שירים כמועדפים. לחץ על הלב ליד כל שיר.</p>
          <button className="btn ghost" onClick={() => setView('songs')}>לכל השירים</button>
        </div>
      )}
    </div>
  );
}
