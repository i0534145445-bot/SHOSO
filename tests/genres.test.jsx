import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { normalizeGenre, bookGenres, genresList, booksOfGenre, parseGenreInput } from '../src/lib/genres.js';
import {
  bootstrap, setState, getState, genresOfLibrary, booksInGenre, addBookGenres,
  removeBookGenre, collectionsFromGenres, withGenres,
} from '../src/lib/store.js';
import BookList from '../src/components/BookList.jsx';

const book = (id, genres, extra = {}) => ({
  id,
  path: `/books/${id}.epub`,
  dir: '/books',
  fileName: `${id}.epub`,
  title: `ספר ${id}`,
  author: 'מחבר',
  language: 'he',
  format: 'EPUB',
  ext: '.epub',
  size: 1000,
  mtime: 1,
  cover: null,
  pageCount: 0,
  chapters: 1,
  wordCount: 100,
  addedAt: 1,
  genres,
  ...extra,
});

beforeAll(async () => {
  await bootstrap();
});

const reset = (books, extra = {}) => {
  setState({
    books,
    favorites: [],
    recent: [],
    progress: {},
    bookmarks: {},
    highlights: {},
    collections: [],
    customGenres: {},
    query: '',
    sort: { key: 'title', dir: 'asc' },
    view: 'books',
    currentBookId: null,
    layout: 'full',
    ...extra,
  });
};

describe('genre labels', () => {
  it('translates FB2 codes and English subjects', () => {
    expect(normalizeGenre('sf_history')).toBe('מדע בדיוני היסטורי');
    expect(normalizeGenre('prose_classic')).toBe('קלאסיקה');
    expect(normalizeGenre('Science Fiction')).toBe('מדע בדיוני');
    expect(normalizeGenre('Detective stories')).toBe('מתח ובלשים');
    expect(normalizeGenre('Literary Fiction')).toBe('פרוזה');
  });

  it('keeps Hebrew labels as they are and drops noise', () => {
    expect(normalizeGenre('מתח בלשים')).toBe('מתח בלשים');
    expect(normalizeGenre('   ')).toBe('');
    expect(normalizeGenre('12345')).toBe('');
    expect(normalizeGenre('א'.repeat(80))).toBe('');
  });

  it('splits, dedupes and caps a book’s genres', () => {
    expect(bookShelf()).toEqual(['מדע בדיוני', 'היסטוריה']);
    function bookShelf() {
      return bookGenres({ genres: ['Science Fiction, History', 'science fiction', 'sf'] });
    }
    expect(bookGenres({ genres: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'].map((g) => `${g}${'x'.repeat(3)}`) })).toHaveLength(6);
    expect(parseGenreInput('פנטזיה, הרפתקאות')).toEqual(['פנטזיה', 'הרפתקאות']);
  });

  it('counts shelves and finds their books', () => {
    const books = [book('a', ['פנטזיה']), book('b', ['פנטזיה', 'מתח']), book('c', [])];
    const shelves = genresList(books);
    expect(shelves.map((s) => `${s.genre}:${s.count}`)).toEqual(['פנטזיה:2', 'מתח:1']);
    expect(booksOfGenre(books, 'פנטזיה').map((b) => b.id)).toEqual(['a', 'b']);
  });
});

describe('genres in the library', () => {
  it('groups the library and ignores books without a genre', () => {
    reset([book('a', ['פנטזיה']), book('b', ['פנטזיה', 'מתח']), book('c', [])]);
    expect(genresOfLibrary().map((g) => g.genre).sort()).toEqual(['מתח', 'פנטזיה'].sort());
    expect(booksInGenre('מתח').map((b) => b.id)).toEqual(['b']);
  });

  it('keeps a hand-added genre even when the scan rewrites the book', () => {
    reset([book('a', ['פנטזיה'])]);
    addBookGenres('a', 'מתח בלשים');
    expect(getState().customGenres.a).toEqual(['מתח בלשים']);
    // a rescan replaces the whole book entry, without the manual genre
    setState({ books: [{ ...book('a', ['פנטזיה']), title: 'שם חדש' }] });
    expect(genresOfLibrary().map((g) => g.genre)).toContain('מתח בלשים');
    expect(withGenres(getState().books[0]).genres).toEqual(['פנטזיה', 'מתח בלשים']);
    removeBookGenre('a', 'מתח בלשים');
    expect(genresOfLibrary().map((g) => g.genre)).not.toContain('מתח בלשים');
  });

  it('does not duplicate a genre the file already has', () => {
    reset([book('a', ['פנטזיה'])]);
    addBookGenres('a', 'פנטזיה');
    expect(getState().customGenres.a).toEqual([]);
  });

  it('builds one shelf per genre, once', () => {
    reset([book('a', ['פנטזיה']), book('b', ['מתח'])]);
    expect(collectionsFromGenres()).toBe(2);
    expect(getState().collections.map((c) => c.name).sort()).toEqual(['מתח', 'פנטזיה'].sort());
    // running it again only tops up, never duplicates
    expect(collectionsFromGenres()).toBe(0);
    expect(getState().collections).toHaveLength(2);
  });
});

describe('a very large library', () => {
  it('renders one page of rows and offers the rest', () => {
    const many = Array.from({ length: 500 }, (_, i) => book(`b${i}`, ['פנטזיה']));
    reset(many);
    render(<BookList books={many} from="books" />);
    expect(document.querySelectorAll('.book-row').length).toBe(120);
    expect(screen.getByText(/מציגים 120 מתוך 500/)).toBeTruthy();
    act(() => { fireEvent.click(screen.getByText('טען עוד')); });
    expect(document.querySelectorAll('.book-row').length).toBe(360);
    act(() => { fireEvent.click(screen.getByText('טען עוד')); });
    expect(document.querySelectorAll('.book-row').length).toBe(500);
    expect(screen.queryByText('טען עוד')).toBeNull();
    cleanup();
  });
});
