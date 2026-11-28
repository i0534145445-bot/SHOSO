import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import App from '../src/components/App.jsx';
import { bootstrap, setState } from '../src/lib/store.js';

/**
 * Every library view must draw something. The "brief" view once crashed the
 * whole window (a component that was used but never defined) and the CI
 * screenshots were the only place it showed up – this keeps it in the tests.
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
  size: 1000,
  mtime: 1700000000000 + i,
  cover: null,
  pageCount: 0,
  chapters: 3,
  wordCount: 1000,
  addedAt: 1700000000000 + i,
});

beforeAll(async () => {
  await bootstrap();
});

const VIEWS = [
  ['full', '.book-row'],
  ['brief', '.brief-row'],
  ['thumbs', '.book-tile'],
  ['grid', '.book-tile'],
];

describe('library views', () => {
  for (const [layout, selector] of VIEWS) {
    it(`draws the ${layout} view`, () => {
      setState({
        books: [makeBook(1), makeBook(2), makeBook(3)],
        view: 'books',
        query: '',
        layout,
        progress: {},
      });
      const { container, unmount } = render(<App />);
      expect(container.querySelectorAll(selector).length).toBeGreaterThan(0);
      unmount();
    });
  }
});
