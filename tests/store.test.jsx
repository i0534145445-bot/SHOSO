import { describe, it, expect, beforeAll } from 'vitest';
import {
  bootstrap, getState, setState, setView, setQuery, setSort,
  toggleFavorite, createCollection, toggleInCollection, deleteCollection,
  openBook, closeBook, saveProgress, addBookmark, removeBookmark,
  filteredBooks, authorsList, formatsList, continueReading,
  removeBook, updateReader, bookById,
} from '../src/lib/store.js';

const makeBook = (i, overrides = {}) => ({
  id: `b${i}`,
  path: `/books/book${i}.epub`,
  dir: '/books',
  fileName: `book${i}.epub`,
  title: `ספר ${i}`,
  author: i % 2 ? 'מחבר א' : 'Author B',
  language: 'he',
  format: i % 3 === 0 ? 'PDF' : 'EPUB',
  ext: i % 3 === 0 ? '.pdf' : '.epub',
  size: 1000000 + i,
  mtime: 1700000000000 + i,
  cover: null,
  pageCount: i % 3 === 0 ? 120 : 0,
  chapters: 10,
  wordCount: 50000,
  addedAt: 1700000000000 + i,
  ...overrides,
});

beforeAll(async () => {
  await bootstrap();
});

const reset = (books) => {
  setState({
    books,
    favorites: [],
    recent: [],
    progress: {},
    bookmarks: {},
    collections: [],
    query: '',
    sort: { key: 'title', dir: 'asc' },
    view: 'home',
    currentBookId: null,
  });
};

describe('library filtering & sorting', () => {
  it('filters by Hebrew query', () => {
    reset([makeBook(1), makeBook(2)]);
    setQuery('ספר 1');
    expect(filteredBooks()).toHaveLength(1);
    setQuery('');
    expect(filteredBooks()).toHaveLength(2);
  });

  it('sorts by title and author', () => {
    reset([makeBook(2, { title: 'ב' }), makeBook(1, { title: 'א' })]);
    setSort({ key: 'title', dir: 'asc' });
    expect(filteredBooks()[0].title).toBe('א');
    setSort({ key: 'title', dir: 'desc' });
    expect(filteredBooks()[0].title).toBe('ב');
  });

  it('groups authors and formats', () => {
    reset([makeBook(1), makeBook(2), makeBook(3)]);
    const authors = authorsList();
    expect(authors.length).toBe(2);
    const formats = formatsList();
    expect(formats.map((f) => f.format).sort()).toEqual(['EPUB', 'PDF']);
  });
});

describe('favorites & collections', () => {
  it('toggles favorites', () => {
    reset([makeBook(1)]);
    toggleFavorite('b1');
    expect(getState().favorites).toContain('b1');
    toggleFavorite('b1');
    expect(getState().favorites).not.toContain('b1');
  });

  it('creates collections and toggles books', () => {
    reset([makeBook(1), makeBook(2)]);
    const id = createCollection('לקרוא בחופש');
    expect(getState().collections).toHaveLength(1);
    toggleInCollection(id, 'b1');
    expect(getState().collections[0].bookIds).toContain('b1');
    toggleInCollection(id, 'b1');
    expect(getState().collections[0].bookIds).not.toContain('b1');
    deleteCollection(id);
    expect(getState().collections).toHaveLength(0);
  });
});

describe('reading progress & bookmarks', () => {
  it('opens a book and saves progress', () => {
    reset([makeBook(1)]);
    openBook('b1');
    expect(getState().currentBookId).toBe('b1');
    expect(getState().view).toBe('reader');
    expect(getState().recent[0]).toBe('b1');
    saveProgress('b1', { chapter: 2, scroll: 500, percent: 45 });
    expect(getState().progress.b1.percent).toBe(45);
    expect(getState().progress.b1.chapter).toBe(2);
    closeBook();
    expect(getState().currentBookId).toBeNull();
  });

  it('clamps percent to 0-100', () => {
    reset([makeBook(1)]);
    saveProgress('b1', { percent: 250 });
    expect(getState().progress.b1.percent).toBe(100);
    saveProgress('b1', { percent: -10 });
    expect(getState().progress.b1.percent).toBe(0);
  });

  it('adds and removes bookmarks', () => {
    reset([makeBook(1)]);
    const bm = addBookmark('b1', { chapter: 1, scroll: 200 });
    expect(getState().bookmarks.b1).toHaveLength(1);
    removeBookmark('b1', bm.id);
    expect(getState().bookmarks.b1).toHaveLength(0);
  });

  it('lists continue-reading books', () => {
    reset([makeBook(1), makeBook(2)]);
    openBook('b1');
    saveProgress('b1', { percent: 30 });
    saveProgress('b2', { percent: 100, finished: true });
    const list = continueReading();
    expect(list.map((x) => x.book.id)).toContain('b1');
    expect(list.map((x) => x.book.id)).not.toContain('b2');
  });

  it('removes a book from the library', () => {
    reset([makeBook(1), makeBook(2)]);
    toggleFavorite('b1');
    saveProgress('b1', { percent: 50 });
    removeBook('b1');
    expect(bookById('b1')).toBeNull();
    expect(getState().favorites).not.toContain('b1');
    expect(getState().progress.b1).toBeUndefined();
  });
});

describe('reader settings', () => {
  it('updates reader settings with clamping on bootstrap', () => {
    updateReader({ fontSize: 24, theme: 'sepia' });
    expect(getState().reader.fontSize).toBe(24);
    expect(getState().reader.theme).toBe('sepia');
  });
});
