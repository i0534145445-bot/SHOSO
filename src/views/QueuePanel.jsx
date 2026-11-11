import React from 'react';
import {
  useStore, playTrack, removeFromQueue, clearQueue, toggleShuffle, cycleRepeat, trackById, setView,
} from '../lib/store.js';
import Cover from '../components/Cover.jsx';
import { IconTrash, IconShuffle, IconRepeat, IconRepeatOne, IconClose } from '../lib/icons.jsx';
import { formatTime } from '../lib/format.js';

export default function QueuePanel() {
  const queue = useStore((s) => s.queue);
  const queueIndex = useStore((s) => s.queueIndex);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);

  const items = queue.map((id, index) => ({ track: trackById(id), index })).filter((x) => x.track);
  const upNext = items.filter((x) => x.index > queueIndex);
  const played = items.filter((x) => x.index < queueIndex);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2 className="view-title">תור נגינה</h2>
          <p className="view-sub">
            {items.length} שירים · {upNext.length} ממתינים ·{' '}
            {formatTime(upNext.reduce((s, x) => s + (x.track.duration || 0), 0), { hours: true })}
          </p>
        </div>
        <div className="queue-actions">
          <button className={`btn ghost ${shuffle ? 'active' : ''}`} onClick={toggleShuffle}>
            <IconShuffle size={16} /> אקראי
          </button>
          <button className={`btn ghost ${repeat !== 'off' ? 'active' : ''}`} onClick={cycleRepeat}>
            {repeat === 'one' ? <IconRepeatOne size={16} /> : <IconRepeat size={16} />}
            {repeat === 'off' ? 'חזרה כבויה' : repeat === 'all' ? 'חזרה על הכל' : 'חזרה על שיר'}
          </button>
          <button className="btn ghost" onClick={clearQueue}>
            <IconTrash size={16} /> נקה
          </button>
        </div>
      </div>

      {!items.length && (
        <div className="empty-state">
          <p>התור ריק. בחר שיר כדי להתחיל.</p>
          <button className="btn ghost" onClick={() => setView('songs')}>לכל השירים</button>
        </div>
      )}

      {queueIndex >= 0 && items[queueIndex] && (
        <section className="shelf">
          <div className="shelf-head"><h3>מתנגן עכשיו</h3></div>
          <div className="queue-current">
            <Cover src={items[queueIndex].track.picture} name={items[queueIndex].track.album} size={72} rounded={12} />
            <div>
              <div className="q-title">{items[queueIndex].track.title}</div>
              <div className="q-sub">{items[queueIndex].track.artist}</div>
            </div>
            <span className="q-dur">{formatTime(items[queueIndex].track.duration)}</span>
          </div>
        </section>
      )}

      {upNext.length > 0 && (
        <section className="shelf">
          <div className="shelf-head"><h3>בהמשך</h3></div>
          <div className="queue-list">
            {upNext.map(({ track, index }) => (
              <div key={`${track.id}-${index}`} className="queue-row" onDoubleClick={() => playTrack(track, { queue })}>
                <span className="q-handle">≡</span>
                <Cover src={track.picture} name={track.album} size={40} rounded={8} />
                <div className="q-main">
                  <div className="q-title">{track.title}</div>
                  <div className="q-sub">{track.artist}</div>
                </div>
                <span className="q-dur">{formatTime(track.duration)}</span>
                <button className="icon-btn tiny" title="הסר מהתור" onClick={() => removeFromQueue(index)}>
                  <IconClose size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {played.length > 0 && (
        <section className="shelf">
          <div className="shelf-head"><h3>נגנו קודם</h3></div>
          <div className="queue-list dimmed">
            {played.map(({ track, index }) => (
              <div key={`${track.id}-${index}`} className="queue-row" onDoubleClick={() => playTrack(track, { queue })}>
                <span className="q-handle">≡</span>
                <Cover src={track.picture} name={track.album} size={36} rounded={6} />
                <div className="q-main">
                  <div className="q-title">{track.title}</div>
                  <div className="q-sub">{track.artist}</div>
                </div>
                <span className="q-dur">{formatTime(track.duration)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
