import { describe, it, expect, beforeAll } from 'vitest';
import {
  bootstrap, getState, setState, setView, setQuery, setSort,
  toggleFavorite, createCollection, toggleInCollection, deleteCollection,
  openBook, closeBook, saveProgress, addBookmark, removeBookmark,
  filteredBooks, authorsList, formatsList, continueReading,
  removeBook, updateReader, bookById, removeFolder, restoreBook, reconcileBooks,
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

describe('library membership', () => {
  it('removing a scanned folder moves its books to the trash, not into nothing', () => {
    setState({
      books: [
        makeBook(1, { path: '/books/a.epub', folders: [] }),
        makeBook(2, { path: '/other/b.epub' }),
      ],
      folders: ['/books', '/other'],
      trash: [],
      favorites: ['b1', 'b2'],
      progress: {},
      bookmarks: {},
      recent: ['b1'],
      collections: [{ id: 's1', name: 'מדף', bookIds: ['b1', 'b2'], createdAt: 1 }],
    });
    removeFolder('/books');
    const state = getState();
    expect(state.books.map((b) => b.id)).toEqual(['b2']);
    expect(state.trash.map((b) => b.id)).toEqual(['b1']);
    expect(state.folders).toEqual(['/other']);
    // nothing the reader saved about that book is left behind
    expect(state.favorites).toEqual(['b2']);
    expect(state.recent).toEqual([]);
    expect(state.collections[0].bookIds).toEqual(['b2']);
    // and it can be brought back
    restoreBook('b1');
    expect(getState().books.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
  });

  it('removing a book keeps it restorable in the trash', () => {
    setState({ books: [makeBook(7, { path: '/books/seven.epub' })], trash: [], favorites: [], recent: [], collections: [], progress: {}, bookmarks: {} });
    removeBook('b7');
    expect(getState().books.length).toBe(0);
    expect(getState().trash.length).toBe(1);
    restoreBook('b7');
    expect(getState().books.length).toBe(1);
  });
});

describe('reconciling a scan with the library', () => {
  const inLib = (id, extra = {}) => ({ ...makeBook(0), id, path: `/books/${id}.epub`, ...extra });

  it('adds new files, refreshes changed ones and keeps the reader history', () => {
    const old = inLib('a', { mtime: 1, title: 'ישן', addedAt: 111 });
    const result = reconcileBooks({
      books: [old],
      scanned: [{ ...old, mtime: 2, title: 'חדש', cover: 'shoso-media://cover/?p=x' }],
      folders: ['/books'],
    });
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.books).toHaveLength(1);
    expect(result.books[0].title).toBe('חדש');
    expect(result.books[0].cover).toContain('shoso-media');
    // when the reader added it is not lost just because the file was re-read
    expect(result.books[0].addedAt).toBe(111);
  });

  it('drops books whose file disappeared, and reports them', () => {
    const result = reconcileBooks({
      books: [inLib('a'), inLib('b')],
      scanned: [inLib('a')],
      folders: ['/books'],
    });
    expect(result.removed).toBe(1);
    expect(result.removedIds).toEqual(['b']);
    expect(result.books.map((b) => b.id)).toEqual(['a']);
  });

  it('never touches books outside the scanned folders, or a folder that did not answer', () => {
    const manual = { ...makeBook(0), id: 'm', path: 'C:/Downloads/one.pdf' };
    const elsewhere = inLib('x', { path: '/other/x.epub' });
    const result = reconcileBooks({ books: [inLib('a'), manual, elsewhere], scanned: [inLib('a')], folders: ['/books'] });
    expect(result.books.map((b) => b.id).sort()).toEqual(['a', 'm', 'x']);
    expect(result.removed).toBe(0);
    // an unplugged drive: nothing answered, so nothing is dropped
    const empty = reconcileBooks({ books: [elsewhere], scanned: [], folders: [] });
    expect(empty.removed).toBe(0);
    expect(empty.books).toHaveLength(1);
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
