import React from 'react';
import { useStore, recentTracks, mostPlayed, setView } from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import { playTrack } from '../lib/store.js';

const dayLabel = (ts) => {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(date, today)) return 'היום';
  if (same(date, yesterday)) return 'אתמול';
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
};

export default function HistoryView() {
  const history = useStore((s) => s.history);
  const top = useStore(() => mostPlayed(15));
  const tracks = useStore((s) => s.tracks);

  const grouped = [];
  for (const entry of history) {
    const label = dayLabel(entry.at);
    let group = grouped.find((g) => g.label === label);
    if (!group) {
      group = { label, entries: [] };
      grouped.push(group);
    }
    const track = tracks.find((t) => t.id === entry.id);
    if (track) group.entries.push({ track, at: entry.at });
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">היסטוריית האזנה</h2>
          <p className="view-sub">{history.length} השמעות</p>
        </div>
      </div>

      {top.length > 0 && (
        <section className="shelf">
          <div className="shelf-head"><h3>הכי מושמעים</h3></div>
          <div className="shelf-row">
            {top.slice(0, 10).map(({ track, count }) => (
              <button key={track.id} className="mini-card" onClick={() => playTrack(track, { queue: tracks.map((t) => t.id) })}>
                <Cover src={track.picture} name={track.album} size={112} rounded={12} />
                <div className="mini-title">{track.title}</div>
                <div className="mini-sub">{count} השמעות</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {!history.length && (
        <div className="empty-state">
          <p>עוד לא האזנת לשירים.</p>
          <button className="btn ghost" onClick={() => setView('songs')}>לכל השירים</button>
        </div>
      )}

      {grouped.map((group) => (
        <section className="shelf" key={group.label}>
          <div className="shelf-head"><h3>{group.label}</h3></div>
          <div className="queue-list">
            {group.entries.map(({ track, at }, i) => (
              <div key={`${track.id}-${i}`} className="queue-row" onDoubleClick={() => playTrack(track, { queue: tracks.map((t) => t.id) })}>
                <Cover src={track.picture} name={track.album} size={40} rounded={8} />
                <div className="q-main">
                  <div className="q-title">{track.title}</div>
                  <div className="q-sub">{track.artist}</div>
                </div>
                <span className="q-dur">{new Date(at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
