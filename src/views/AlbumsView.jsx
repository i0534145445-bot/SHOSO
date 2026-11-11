import React, { useMemo } from 'react';
import { useStore, albums, playQueue, openAlbum } from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import { IconPlay } from '../lib/icons.jsx';
import { normalize } from '../lib/format.js';

export default function AlbumsView() {
  const albumList = useStore(() => albums());
  const query = useStore((s) => s.query);
  const sort = useStore((s) => s.sort);

  const visible = useMemo(() => {
    const filtered = query
      ? albumList.filter((a) => normalize(`${a.album} ${a.artist} ${a.year}`).includes(normalize(query)))
      : albumList;
    const sorted = [...filtered];
    if (sort.key === 'year') sorted.sort((a, b) => String(a.year).localeCompare(String(b.year)));
    if (sort.key === 'title') sorted.sort((a, b) => a.album.localeCompare(b.album, 'he'));
    return sorted;
  }, [albumList, query, sort.key]);

  if (!albumList.length) {
    return <div className="empty-state"><p>אין אלבומים בספרייה</p></div>;
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">אלבומים</h2>
          <p className="view-sub">{visible.length} אלבומים</p>
        </div>
      </div>

      <div className="grid-cards">
        {visible.map((album) => (
          <div key={album.key} className="album-card">
            <button
              className="album-cover"
              onClick={() => openAlbum({ album: album.album, artist: album.artist })}
            >
              <Cover src={album.picture} name={album.album} size="100%" rounded={14} className="fill" />
              <span
                className="play-fab"
                onClick={(e) => {
                  e.stopPropagation();
                  playQueue(album.tracks.map((t) => t.id), 0);
                }}
                role="button"
                tabIndex={-1}
                title="נגן אלבום"
              >
                <IconPlay size={20} />
              </span>
            </button>
            <div className="album-name" title={album.album}>{album.album}</div>
            <div className="album-artist" title={album.artist}>{album.artist}</div>
            <div className="album-meta">{album.tracks.length} שירים{album.year ? ` · ${album.year}` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
