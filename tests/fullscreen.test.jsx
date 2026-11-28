import React from 'react';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import App from '../src/components/App.jsx';
import { bootstrap, setState, getState, setView } from '../src/lib/store.js';
import { isFullscreen } from '../src/lib/fullscreen.js';

/**
 * Fullscreen hides every way out of the window, so these tests hold the two
 * things that must never break: Escape leaves fullscreen (instead of closing
 * the book or clearing the search), and a visible exit control exists as soon
 * as the real window reports it is fullscreen.
 */

const makeBook = (i) => ({
  id: `b${i}`,
  path: `/books/book${i}.epub`,
  dir: '/books',
  fileName: `book${i}.epub`,
  title: `ספר ${i}`,
  author: 'מחבר בדיקה',
  language: 'he',
  format: 'EPUB',
  ext: '.epub',
  size: 1000000,
  mtime: 1700000000000 + i,
  cover: null,
  pageCount: 0,
  chapters: 5,
  wordCount: 40000,
  addedAt: 1700000000000 + i,
});

const calls = [];
let push = () => {};
let mounted = [];

beforeAll(async () => {
  await bootstrap();
});

window.shoso = {
  isElectron: true,
  isFullscreen: () => false,
  toggleFullscreen: () => { calls.push('toggle'); },
  setFullscreen: (value) => { calls.push(`set:${value}`); },
  onFullscreenChange: (cb) => {
    push = cb;
    return () => { push = () => {}; };
  },
};

beforeEach(() => {
  calls.length = 0;
  act(() => push(false));
  mounted.forEach((view) => view.unmount());
  mounted = [];
});

const mount = (ui = <App />) => {
  const view = render(ui);
  mounted.push(view);
  return view;
};

describe('fullscreen', () => {
  it('Escape leaves fullscreen instead of closing the book', () => {
    setState({ books: [makeBook(1)], view: 'book', detailBookId: 'b1', progress: {} });
    const { container } = mount();
    fireEvent.click(container.querySelector('.bd-read'));
    expect(getState().view).toBe('reader');

    act(() => push(true));
    expect(isFullscreen()).toBe(true);
    expect(container.querySelector('.fullscreen-exit')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(calls).toEqual(['set:false']);
    // the book is still open – Escape meant the window, not the reader
    expect(getState().view).toBe('reader');

    // and once the window reports it, the same key closes the book again
    act(() => push(false));
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(getState().view).not.toBe('reader');
  });

  it('shows a real way out on the library screen too', () => {
    setState({ books: [makeBook(2)], view: 'library', query: '' });
    const { container } = mount();
    expect(container.querySelector('.fullscreen-exit')).toBeNull();

    act(() => push(true));
    const button = container.querySelector('.fullscreen-exit');
    expect(button.getAttribute('aria-label')).toBe('צא ממסך מלא');

    fireEvent.click(button);
    expect(calls).toEqual(['set:false']);
    act(() => push(false));
    expect(container.querySelector('.fullscreen-exit')).toBeNull();
  });

  it('Escape in the library leaves fullscreen before clearing the search', () => {
    setState({ books: [makeBook(3)], view: 'library', query: 'ספר' });
    mount();
    act(() => push(true));

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(calls).toEqual(['set:false']);
    expect(getState().query).toBe('ספר');

    act(() => { push(false); setView('library'); });
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(getState().query).toBe('');
  });
});
