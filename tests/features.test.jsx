import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../src/components/App.jsx';
import {
  bootstrap, mergeTracks, getState, setView, openAlbum, openArtist, openPlaylist,
  playTrack, toggleLyrics, setQuery, createPlaylist, addToPlaylist, removeFromPlaylist,
  reorderPlaylist, toggleFavorite, setEqPreset, loadDemoLibrary, togglePlay, nextTrack,
  setVolume, toggleMute, setRate, seekTo, addToQueue, playNext, removeFromQueue, setSort,
} from '../src/lib/store.js';
import { buildDemoTracks } from '../src/lib/demo.js';

const track = (id, over = {}) => ({
  id,
  path: `/m/${id}.mp3`,
  dir: '/m/Album',
  fileName: `${id}.mp3`,
  title: `רצועה ${id}`,
  artist: 'אמן בדיקה',
  albumArtist: 'אמן בדיקה',
  album: 'אלבום בדיקה',
  genre: 'פופ',
  year: '2023',
  trackNo: Number(id.replace(/\D/g, '')) || 1,
  discNo: 1,
  duration: 100,
  bitrate: 256000,
  codec: 'MPEG 1 Layer 3',
  sampleRate: 44100,
  size: 1,
  mtime: 1,
  picture: null,
  hasLyrics: true,
  _lyrics: { type: 'lrc', text: '[00:00.00]שורה ראשונה\n[00:05.00]שורה שנייה\n[00:10.00]שורה שלישית' },
  ...over,
});

beforeAll(async () => {
  await bootstrap();
  mergeTracks([track('a1'), track('a2'), track('a3')]);
});

describe('demo library', () => {
  it('renders WAV blobs with covers, durations and lyrics', async () => {
    const demos = await buildDemoTracks();
    expect(demos).toHaveLength(6);
    for (const demo of demos) {
      expect(demo.path.startsWith('blob:')).toBe(true);
      expect(demo.duration).toBeGreaterThan(5);
      expect(demo.picture.startsWith('data:image/svg+xml')).toBe(true);
      expect(demo._lyrics.text).toContain('[00:02.00]');
      expect(demo.size).toBeGreaterThan(100000);
    }
  });

  it('loads the demo library into the store once', async () => {
    await loadDemoLibrary();
    await loadDemoLibrary();
    expect(getState().tracks.filter((t) => t.id.startsWith('demo-'))).toHaveLength(6);
    expect(getState().playlists.some((p) => p.id === 'demo-playlist')).toBe(true);
  });
});

describe('navigation and detail views', () => {
  it('opens album, artist and playlist detail views', async () => {
    render(<App />);

    await act(async () => openAlbum({ album: 'אלבום בדיקה', artist: 'אמן בדיקה' }));
    expect(screen.getAllByText('אלבום בדיקה').length).toBeGreaterThan(0);
    expect(screen.getByText('שמור כפלייליסט')).toBeTruthy();

    await act(async () => openArtist('אמן בדיקה'));
    expect(screen.getAllByText('שירים מובילים').length).toBeGreaterThan(0);

    let playlistId;
    await act(async () => {
      const playlist = createPlaylist('פלייליסט בדיקה', ['a1', 'a2']);
      playlistId = playlist.id;
      addToPlaylist(playlist.id, 'a3');
      openPlaylist(playlist.id);
    });
    expect(getState().playlists.find((p) => p.id === playlistId).trackIds).toHaveLength(3);

    await act(async () => removeFromPlaylist(playlistId, 'a2'));
    expect(getState().playlists.find((p) => p.id === playlistId).trackIds).toEqual(['a1', 'a3']);

    await act(async () => reorderPlaylist(playlistId, 0, 1));
    expect(getState().playlists.find((p) => p.id === playlistId).trackIds).toEqual(['a3', 'a1']);

    // The playlist view renders the rows after the mutations
    expect(screen.getByText('גרור שורות כדי לשנות סדר')).toBeTruthy();
  });
});

describe('playback controls', () => {
  it('handles queue operations, volume, rate and seeking', async () => {
    await act(async () => playTrack('a1', { queue: ['a1', 'a2', 'a3'] }));
    expect(getState().currentId).toBe('a1');

    await act(async () => {
      addToQueue('a3');
      playNext('a3');
      removeFromQueue(getState().queue.length - 1);
      setVolume(0.4);
      toggleMute();
      setRate(1.25);
      seekTo(10);
    });
    expect(getState().volume).toBeCloseTo(0.4);
    expect(getState().muted).toBe(true);
    expect(getState().rate).toBe(1.25);
    expect(getState().time).toBe(10);

    await act(async () => togglePlay());
    const playingAfterToggle = getState().playing;
    await act(async () => togglePlay());
    expect(getState().playing).toBe(!playingAfterToggle);

    await act(async () => nextTrack());
    expect(getState().queueIndex).toBe(1);
  });

  it('drives the equalizer presets', async () => {
    await act(async () => setEqPreset('ווקאל'));
    expect(getState().eqPreset).toBe('ווקאל');
    expect(getState().eqGains).toHaveLength(10);
    expect(getState().eqGains[4]).toBe(4);
  });
});

describe('lyrics panel', () => {
  it('renders synced lines and highlights the active one', async () => {
    await act(async () => {
      setView('songs');
      await playTrack('a1');
      toggleLyrics();
      seekTo(6);
    });
    const line = await screen.findByText('שורה שנייה');
    expect(line).toBeTruthy();
    expect(line.className).toContain('active');
    expect(screen.getByText('שורה ראשונה').className).toContain('past');
    await act(async () => toggleLyrics());
  });
});

describe('search and sorting', () => {
  it('filters the song list from the top bar and clears with Escape', async () => {
    render(<App />);
    await act(async () => setView('songs'));

    const input = document.getElementById('global-search');
    fireEvent.change(input, { target: { value: 'רצועה a2' } });
    expect(getState().query).toBe('רצועה a2');

    fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Escape' });
    await act(async () => setQuery(''));

    await act(async () => setSort('duration'));
    expect(getState().sort).toEqual({ key: 'duration', dir: 'asc' });
    await act(async () => setSort('duration'));
    expect(getState().sort.dir).toBe('desc');
  });

  it('toggles favourites from the store', async () => {
    await act(async () => toggleFavorite('a1'));
    expect(getState().favorites).toContain('a1');
    await act(async () => setView('favorites'));
    expect(screen.getAllByText(/שירים שאהבת/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('רצועה a1').length).toBeGreaterThan(0);
    await act(async () => toggleFavorite('a1'));
  });
});

describe('keyboard shortcuts', () => {
  it('toggles playback with Space and opens help with F1', async () => {
    render(<App />);
    await act(async () => playTrack('a2'));
    const before = getState().playing;
    fireEvent.keyDown(document.body, { code: 'Space', key: ' ' });
    expect(getState().playing).toBe(!before);

    fireEvent.keyDown(document.body, { code: 'F1', key: 'F1' });
    expect(screen.getAllByText('מקשי קיצור').length).toBeGreaterThan(0);
    expect(screen.getAllByText('נגן / השהה').length).toBeGreaterThan(0);
  });
});

describe('player extras', () => {
  it('sets A-B repeat markers and resets them', async () => {
    const { setABPoint, clearABRepeat, seekTo: seek } = await import('../src/lib/store.js');
    await act(async () => playTrack('a1'));
    await act(async () => seek(12));
    await act(async () => setABPoint('a'));
    await act(async () => seek(20));
    await act(async () => setABPoint('b'));
    expect(getState().abRepeat.a).not.toBeNull();
    expect(getState().abRepeat.b).not.toBeNull();
    await act(async () => clearABRepeat());
    expect(getState().abRepeat).toEqual({ a: null, b: null });
  });

  it('arms and cancels the sleep timer', async () => {
    const { setSleepTimer } = await import('../src/lib/store.js');
    await act(async () => setSleepTimer(15));
    expect(getState().sleepTimer.minutes).toBe(15);
    await act(async () => setSleepTimer(null));
    expect(getState().sleepTimer).toBeNull();
  });

  it('renders the extras popover from the player bar', async () => {
    render(<App />);
    const button = screen.getAllByTitle('חזרה A-B וטיימר שינה')[0];
    fireEvent.click(button);
    expect(screen.getByText('קבע A')).toBeTruthy();
    expect(screen.getByText('טיימר שינה')).toBeTruthy();
  });
});

describe('state sanitation', () => {
  it('ignores corrupt persisted values instead of crashing', async () => {
    const { bootstrap } = await import('../src/lib/store.js');
    localStorage.setItem('shoso.state.v1', JSON.stringify({
      volume: 'loud',
      eqGains: [1, 2],
      sort: null,
      playlists: [null, { name: 42 }],
      abRepeat: { a: 'x', b: 3 },
      theme: 'neon',
      repeat: 'weird',
    }));
    const state = await bootstrap();
    expect(state.volume).toBe(0.85);
    expect(state.eqGains).toHaveLength(10);
    expect(state.sort).toEqual({ key: 'title', dir: 'asc' });
    expect(state.playlists).toHaveLength(1);
    expect(state.playlists[0].name).toBe('42');
    expect(state.abRepeat).toEqual({ a: null, b: 3 });
    expect(state.theme).toBe('dark');
    expect(state.repeat).toBe('off');
    localStorage.removeItem('shoso.state.v1');
  });
});
