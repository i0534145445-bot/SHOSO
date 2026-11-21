import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../src/components/App.jsx';
import { bootstrap, setState, setView, getState } from '../src/lib/store.js';

const makeBook = (i, overrides = {}) => ({
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
  ...overrides,
});

beforeAll(async () => {
  await bootstrap();
});

describe('SHOSO Books app', () => {
  it('renders the empty state with import actions', () => {
    setState({ books: [], view: 'home', query: '', favorites: [], recent: [], progress: {} });
    render(<App />);
    expect(screen.getByText('ברוך הבא ל-SHOSO Books')).toBeTruthy();
    expect(screen.getAllByText(/הוסף תיקיות ספרים/).length).toBeGreaterThan(0);
  });

  it('renders the library grid and navigates views', () => {
    setState({ books: [makeBook(1), makeBook(2)], view: 'library', query: '' });
    render(<App />);
    expect(screen.getAllByText('ספר 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ספר 2').length).toBeGreaterThan(0);
    act(() => setView('authors'));
    expect(screen.getAllByText('מחבר בדיקה').length).toBeGreaterThan(0);
    act(() => setView('home'));
  });

  it('filters books by search query', () => {
    setState({ books: [makeBook(1), makeBook(2)], view: 'library', query: 'ספר 1' });
    render(<App />);
    expect(screen.getAllByText('ספר 1').length).toBeGreaterThan(0);
    expect(screen.queryByText('ספר 2')).toBeNull();
    act(() => setState({ query: '' }));
  });

  it('shows favorites view', () => {
    setState({ books: [makeBook(1)], favorites: ['b1'], view: 'favorites', query: '' });
    render(<App />);
    expect(screen.getAllByText('ספר 1').length).toBeGreaterThan(0);
    act(() => setState({ favorites: [], view: 'home' }));
  });

  it('shows settings with demo loader', () => {
    setState({ books: [], view: 'settings' });
    render(<App />);
    expect(screen.getAllByText('ספרי דמו').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/טען ספרי דמו/).length).toBeGreaterThan(0);
    act(() => setView('home'));
  });
});
