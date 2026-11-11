import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../src/components/App.jsx';
import {
  bootstrap, setView, mergeTracks, createPlaylist, addToPlaylist, toggleFavorite,
  setQuery, getState, setState, albums, artists, genres, filteredTracks, sortTracks,
  playTrack, togglePlay, nextTrack, setEqPreset, getState as gs,
} from '../src/lib/store.js';
import { parseLrc, activeLineIndex } from '../src/lib/lrc.js';
import { formatTime, matchesQuery, trackHaystack, stripNiqqud } from '../src/lib/format.js';

const makeTrack = (i, overrides = {}) => ({
  id: `t${i}`,
  path: `/music/song${i}.mp3`,
  dir: '/music/album-a',
  fileName: `song${i}.mp3`,
  title: `שיר ${i}`,
  artist: i % 2 ? 'אמן א' : 'Artist B',
  albumArtist: '',
  album: 'אלבום ראשון',
  genre: 'פופ',
  year: '2024',
  trackNo: i,
  discNo: 1,
  duration: 120 + i,
  bitrate: 320000,
  codec: 'MPEG 1 Layer 3',
  sampleRate: 44100,
  size: 4000000,
  mtime: 1700000000000 + i,
  picture: null,
  hasLyrics: false,
  ...overrides,
});

beforeAll(async () => {
  await bootstrap();
});

describe('formatting helpers', () => {
  it('formats durations', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(3725)).toBe('1:02:05');
  });

  it('matches Hebrew queries with and without niqqud', () => {
    const haystack = trackHaystack(makeTrack(1, { title: 'שָׁלוֹם עולם' }));
    expect(matchesQuery(haystack, 'שלום')).toBe(true);
    expect(matchesQuery(haystack, 'עולם אמן')).toBe(true);
    expect(matchesQuery(haystack, 'לא קיים')).toBe(false);
    expect(stripNiqqud('שָׁלוֹם')).toBe('שלום');
  });
});

describe('LRC parsing', () => {
  it('parses synced lyrics and finds the active line', () => {
    const { lines, isSynced } = parseLrc('[ar:אמן]\n[00:01.50]שורה ראשונה\n[00:05.00][00:09.25]שורה שנייה');
    expect(isSynced).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines[0].time).toBeCloseTo(1.5);
    expect(activeLineIndex(lines, 0)).toBe(-1);
    expect(activeLineIndex(lines, 2)).toBe(0);
    expect(activeLineIndex(lines, 9.4)).toBe(2);
  });

  it('handles unsynced text', () => {
    const { lines, isSynced } = parseLrc('בלי זמנים\nעוד שורה');
    expect(isSynced).toBe(false);
    expect(lines.map((l) => l.text)).toEqual(['בלי זמנים', 'עוד שורה']);
  });
});

describe('library selectors', () => {
  it('groups albums, artists and genres', () => {
    mergeTracks([makeTrack(1), makeTrack(2), makeTrack(3, { album: 'אלבום שני', genre: 'רוק' })]);
    const albumList = albums();
    // Same album name under different artists counts as separate albums.
    expect(albumList.length).toBe(3);
    expect(albumList.reduce((s, a) => s + a.tracks.length, 0)).toBe(3);
    expect(artists().length).toBe(2);
    expect(genres().length).toBe(2);
  });

  it('filters and sorts tracks', () => {
    expect(filteredTracks(getState().tracks, 'אמן א').length).toBeGreaterThan(0);
    const sorted = sortTracks(getState().tracks, { key: 'duration', dir: 'desc' });
    expect(sorted[0].duration).toBeGreaterThanOrEqual(sorted[sorted.length - 1].duration);
  });
});

describe('UI smoke test', () => {
  it('renders the shell, navigates views and toggles playback', async () => {
    render(<App />);
    expect(screen.getAllByText('SHOSO').length).toBeGreaterThan(0);

    // Songs list shows all seeded tracks.
    await act(async () => setView('songs'));
    expect(screen.getAllByText('שיר 1').length).toBeGreaterThan(0);
    expect(screen.getByText('נגן הכל')).toBeTruthy();

    // Albums view
    await act(async () => setView('albums'));
    expect(screen.getAllByText('אלבום ראשון').length).toBeGreaterThan(0);

    // Artists view
    await act(async () => setView('artists'));
    expect(screen.getAllByText('אמן א').length).toBeGreaterThan(0);

    // Settings + equalizer
    await act(async () => setView('settings'));
    expect(screen.getByText('אקולייזר 10 ערוצים')).toBeTruthy();
    const presetButton = screen.getByText('בס מוגבר');
    fireEvent.click(presetButton);
    expect(getState().eqGains[0]).toBeGreaterThan(0);
    expect(getState().eqPreset).toBe('בס מוגבר');

    // Search filtering through the store
    await act(async () => {
      setView('songs');
      setQuery('שיר 3');
    });
    expect(within(screen.getByText('שיר 3')).queryByText('x')).toBeNull();
    await act(async () => setQuery(''));

    // Favourites view
    await act(async () => {
      toggleFavorite('t1');
      setView('favorites');
    });
    expect(screen.getAllByText('מועדפים').length).toBeGreaterThan(0);
    expect(screen.getByText(/שירים שאהבת/)).toBeTruthy();

    // Playback: play a track then check the player bar state
    await act(async () => {
      await playTrack('t2');
    });
    expect(getState().currentId).toBe('t2');
    expect(getState().playing).toBe(true);
    expect(getState().queue.length).toBe(3);

    await act(async () => togglePlay());
    expect(getState().playing).toBe(false);

    await act(async () => nextTrack());
    expect(getState().queueIndex).toBeGreaterThan(0);

    // Playlist creation reflects in the sidebar and playlist view
    await act(async () => {
      const playlist = createPlaylist('מיקס בדיקה', ['t1', 't2']);
      window.dispatchEvent(new CustomEvent('shoso:open-playlist', { detail: playlist.id }));
      addToPlaylist(playlist.id, 't3');
      setView('playlist');
    });
    expect(screen.getAllByText('מיקס בדיקה').length).toBeGreaterThan(0);
    expect(getState().playlists[0].trackIds).toHaveLength(3);

    // Queue view
    await act(async () => setView('queue'));
    expect(screen.getAllByText('תור נגינה').length).toBeGreaterThan(0);

    // Empty-state safety: clearing the library should not crash any view
    await act(async () => {
      setState({ tracks: [], queue: [], favorites: [], currentId: null });
    });
    for (const view of ['home', 'songs', 'albums', 'artists', 'folders', 'genre', 'history', 'favorites', 'queue', 'playlists']) {
      await act(async () => setView(view));
    }
    expect(getState().tracks).toHaveLength(0);

    // Restore seed data for later assertions
    await act(async () => mergeTracks([makeTrack(1), makeTrack(2), makeTrack(3)]));
  });
});
