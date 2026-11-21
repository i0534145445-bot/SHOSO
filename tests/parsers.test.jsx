import { describe, it, expect } from 'vitest';
import {
  parseTxt, parseFb2, parseHtml, parseMarkdown, parseEpub,
  splitTextChapters, searchChapters, markdownToHtml, countWords,
  extOf, isSupported,
} from '../src/lib/parsers.js';
import { createDemoBooks } from '../src/lib/demo.js';
import { detectDirection, bookHaystack, matchesQuery, stripNiqqud } from '../src/lib/format.js';

const enc = (s) => new TextEncoder().encode(s).buffer;

describe('format helpers', () => {
  it('detects RTL vs LTR', () => {
    expect(detectDirection('שלום עולם זה טקסט בעברית')).toBe('rtl');
    expect(detectDirection('Hello world this is English text')).toBe('ltr');
  });

  it('matches Hebrew queries with and without niqqud', () => {
    const haystack = bookHaystack({ title: 'שָׁלוֹם עולם', author: 'דוד', format: 'EPUB', fileName: 'a.epub', language: 'he' });
    expect(matchesQuery(haystack, 'שלום')).toBe(true);
    expect(matchesQuery(haystack, 'עולם דוד')).toBe(true);
    expect(matchesQuery(haystack, 'לא קיים')).toBe(false);
    expect(stripNiqqud('שָׁלוֹם')).toBe('שלום');
  });

  it('detects extensions', () => {
    expect(extOf('book.EPUB')).toBe('.epub');
    expect(isSupported('a.pdf')).toBe(true);
    expect(isSupported('a.mobi')).toBe(false);
  });
});

describe('TXT parsing', () => {
  it('splits chapters on headings', () => {
    const text = 'הספר שלי\n\nפרק 1\nטקסט ראשון כאן.\n\nפרק 2\nטקסט שני כאן.';
    const chapters = splitTextChapters(text);
    expect(chapters.length).toBeGreaterThanOrEqual(2);
    const all = chapters.map((c) => c.html).join(' ');
    expect(all).toContain('טקסט ראשון');
    expect(all).toContain('טקסט שני');
  });

  it('parses a full TXT book', () => {
    const result = parseTxt(enc('Chapter 1\nHello world.\n\nChapter 2\nGoodbye world.'));
    expect(result.format).toBe('TXT');
    expect(result.chapters.length).toBeGreaterThanOrEqual(2);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.toc.length).toBe(result.chapters.length);
  });
});

describe('HTML / Markdown parsing', () => {
  it('splits HTML on h1/h2', () => {
    const result = parseHtml(enc('<html><body><h1>פרק א</h1><p>טקסט</p><h2>פרק ב</h2><p>עוד</p></body></html>'));
    expect(result.format).toBe('HTML');
    expect(result.chapters.length).toBe(2);
    expect(result.chapters[0].title).toContain('פרק א');
  });

  it('converts markdown to HTML', () => {
    const html = markdownToHtml('# כותרת\n\nטקסט עם **הדגשה**');
    expect(html).toContain('<h1>');
    expect(html).toContain('<strong>');
  });

  it('parses markdown books', () => {
    const result = parseMarkdown(enc('# פרק 1\n\nשלום עולם'));
    expect(result.format).toBe('MD');
    expect(result.chapters.length).toBeGreaterThanOrEqual(1);
  });
});

describe('FB2 parsing', () => {
  it('extracts title, author and sections', () => {
    const fb2 = `<?xml version="1.0"?><FictionBook><description><title-info><book-title>ספר בדיקה</book-title><author><first-name>דוד</first-name><last-name>כהן</last-name></author><lang>he</lang></title-info></description><body><section><title><p>פרק 1</p></title><p>טקסט ראשון</p></section><section><title><p>פרק 2</p></title><p>טקסט שני</p></section></body></FictionBook>`;
    const result = parseFb2(enc(fb2));
    expect(result.title).toBe('ספר בדיקה');
    expect(result.author).toBe('דוד כהן');
    expect(result.chapters.length).toBe(2);
    expect(result.direction).toBe('rtl');
  });
});

describe('EPUB parsing (demo book)', () => {
  it('parses the generated demo EPUB with chapters and TOC', async () => {
    const books = await createDemoBooks();
    const epub = books.find((b) => b.format === 'EPUB');
    expect(epub).toBeTruthy();
    const result = await parseEpub(epub._buffer);
    expect(result.title).toBe('הספר הישן');
    expect(result.author).toBe('מרים לוי');
    expect(result.chapters.length).toBe(3);
    expect(result.chapters[0].html).toContain('מרים');
    expect(result.toc.length).toBeGreaterThanOrEqual(3);
    expect(result.direction).toBe('rtl');
  });

  it('creates the demo library with a real EPUB, FB2 and several text books', async () => {
    const books = await createDemoBooks();
    expect(books.length).toBeGreaterThanOrEqual(3);
    const formats = new Set(books.map((b) => b.format));
    expect(formats.has('EPUB')).toBe(true);
    expect(formats.has('FB2')).toBe(true);
    expect(formats.has('TXT')).toBe(true);
    // every demo book carries a readable buffer
    books.forEach((b) => expect(b.size).toBeGreaterThan(0));
  });
});

describe('search in book', () => {
  it('finds text across chapters', () => {
    const chapters = [
      { id: 'ch-0', title: 'פרק 1', html: '<p>החתול ישב על הגג</p>' },
      { id: 'ch-1', title: 'פרק 2', html: '<p>הכלב רץ בפארק</p>' },
    ];
    const results = searchChapters(chapters, 'החתול');
    expect(results).toHaveLength(1);
    expect(results[0].chapterIndex).toBe(0);
    expect(results[0].snippet).toContain('החתול');
  });

  it('counts words', () => {
    expect(countWords('שלום עולם hello')).toBe(3);
  });
});
