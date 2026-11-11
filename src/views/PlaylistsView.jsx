import React, { useState } from 'react';
import { useStore, createPlaylist, setView, playQueue, openPlaylist } from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import { IconPlus, IconPlay } from '../lib/icons.jsx';

export default function PlaylistsView() {
  const playlists = useStore((s) => s.playlists);
  const tracks = useStore((s) => s.tracks);
  const [name, setName] = useState('');

  const create = () => {
    const playlist = createPlaylist(name.trim() || 'פלייליסט חדש');
    setName('');
    openPlaylist(playlist.id);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">פלייליסטים</h2>
          <p className="view-sub">{playlists.length} פלייליסטים</p>
        </div>
        <div className="inline-create">
          <input
            value={name}
            placeholder="שם פלייליסט חדש"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button className="btn primary" onClick={create}>
            <IconPlus size={16} /> צור
          </button>
        </div>
      </div>

      {playlists.length === 0 ? (
        <div className="empty-state">
          <p>עוד לא יצרת פלייליסטים. לחץ על אחד מהשירים ובחר „הוסף לפלייליסט”.</p>
        </div>
      ) : (
        <div className="grid-cards">
          {playlists.map((playlist) => {
            const list = playlist.trackIds.map((id) => tracks.find((t) => t.id === id)).filter(Boolean);
            return (
              <div key={playlist.id} className="album-card">
                <button
                  className="album-cover"
                  onClick={() => openPlaylist(playlist.id)}
                >
                  <Cover src={list[0]?.picture} name={playlist.name} size="100%" rounded={14} className="fill" />
                  <span
                    className="play-fab"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (list.length) playQueue(list.map((t) => t.id), 0);
                    }}
                    role="button"
                    tabIndex={-1}
                  >
                    <IconPlay size={20} />
                  </span>
                </button>
                <div className="album-name">{playlist.name}</div>
                <div className="album-meta">{list.length} שירים</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
