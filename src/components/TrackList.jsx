import React from 'react';
import { useStore, playQueue, setSort } from '../lib/store.js';
import TrackRow from './TrackRow.jsx';
import { IconPlay, IconShuffle, IconSort } from '../lib/icons.jsx';
import { formatTime } from '../lib/format.js';

export default function TrackList({
  tracks,
  showHeader = true,
  showAlbum = true,
  showCover = true,
  emptyMessage = 'אין שירים להצגה',
  sortable = true,
  totalLabel,
  queueOverride = null,
}) {
  const sort = useStore((s) => s.sort);
  const queue = queueOverride || tracks.map((t) => t.id);
  const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

  if (!tracks.length) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const columns = [
    { key: null, label: '#', className: 'index' },
    ...(showCover ? [{ key: null, label: '', className: 'art' }] : []),
    { key: 'title', label: 'שיר', className: 'title' },
    ...(showAlbum ? [{ key: 'album', label: 'אלבום', className: 'album' }] : []),
    { key: null, label: '', className: 'badge-cell' },
    { key: 'duration', label: 'משך', className: 'duration' },
    { key: null, label: '', className: 'actions' },
  ];

  return (
    <div className={`track-list ${showCover ? '' : 'without-cover'}`}>
      <div className="list-toolbar">
        <button className="btn primary" onClick={() => playQueue(queue, 0)}>
          <IconPlay size={16} /> נגן הכל
        </button>
        <button
          className="btn ghost"
          onClick={() => playQueue([...queue].sort(() => Math.random() - 0.5), 0)}
        >
          <IconShuffle size={16} /> נגן אקראי
        </button>
        <span className="toolbar-meta">
          {totalLabel || `${tracks.length} שירים · ${formatTime(total, { hours: true })}`}
        </span>
      </div>

      <div className="track-table">
        {showHeader && (
          <div className={`track-header ${showCover ? '' : 'no-cover'} ${showAlbum ? '' : 'no-album'}`}>
            {columns.map((col) => (
              <div key={`${col.className}-${col.key || ''}`} className={`cell ${col.className}`}>
                {sortable && col.key ? (
                  <button className={`sort-btn ${sort.key === col.key ? 'active' : ''}`} onClick={() => setSort(col.key)}>
                    {col.label}
                    {sort.key === col.key && <span className="sort-arrow">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ) : (
                  col.label
                )}
              </div>
            ))}
          </div>
        )}

        <div className="track-body">
          {tracks.map((track, index) => (
            <TrackRow
              key={`${track.id}-${index}`}
              track={track}
              index={index}
              queue={queue}
              showAlbum={showAlbum}
              showCover={showCover}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
