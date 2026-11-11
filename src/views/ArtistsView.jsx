import React, { useMemo } from 'react';
import { useStore, artists, openArtist } from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import { normalize } from '../lib/format.js';

export default function ArtistsView() {
  const artistList = useStore(() => artists());
  const query = useStore((s) => s.query);

  const visible = useMemo(
    () => (query ? artistList.filter((a) => normalize(a.name).includes(normalize(query))) : artistList),
    [artistList, query],
  );

  if (!artistList.length) return <div className="empty-state"><p>אין אמנים בספרייה</p></div>;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">אמנים</h2>
          <p className="view-sub">{visible.length} אמנים</p>
        </div>
      </div>

      <div className="artist-grid">
        {visible.map((artist) => (
          <button
            key={artist.key}
            className="artist-card"
            onClick={() => openArtist(artist.name)}
          >
            <Cover src={artist.picture} name={artist.name} size={148} rounded={999} className="artist-face" />
            <div className="artist-name" title={artist.name}>{artist.name}</div>
            <div className="artist-meta">{artist.tracks.length} שירים · {artist.albumCount} אלבומים</div>
          </button>
        ))}
      </div>
    </div>
  );
}
