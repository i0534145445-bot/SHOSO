import { describe, it, expect } from 'vitest';
import { plainText, openingExcerpt, describeBook } from '../src/lib/description.js';

const enc = (s) => new TextEncoder().encode(s).buffer;

const mkBook = (id, ext, buffer) => ({
  id,
  ext,
  fileName: `book${ext}`,
  path: 'blob:test',
  _buffer: buffer,
});

describe('description helpers', () => {
  it('turns annotated HTML into readable text', () => {
    const text = plainText('<p>שורה אחת</p><p>שורה&nbsp;שנייה &amp; עוד</p>');
    expect(text).toContain('שורה אחת');
    expect(text).toContain('שורה שנייה & עוד');
    expect(text).not.toContain('<');
  });

  it('skips headings and one-word lines when taking an excerpt', () => {
    const raw = 'שם הספר\n\nפרק ראשון\n\nהפסקה הראשונה של הספר הזה היא ארוכה מספיק כדי להיבחר כפתיחה אמיתית של הטקסט.';
    const excerpt = openingExcerpt(raw);
    expect(excerpt).toContain('הפסקה הראשונה');
    expect(excerpt.startsWith('שם הספר')).toBe(false);
  });
});

describe('book descriptions', () => {
  it('reads the annotation of an EPUB from its package file', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
    );
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0"?><package><metadata>
        <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">ספר</dc:title>
        <dc:description xmlns:dc="http://purl.org/dc/elements/1.1/">תיאור אמיתי של הספר, עם <b>הדגשה</b>.</dc:description>
        <dc:publisher xmlns:dc="http://purl.org/dc/elements/1.1/">הוצאה</dc:publisher>
        <dc:date xmlns:dc="http://purl.org/dc/elements/1.1/">2019-05-01</dc:date>
      </metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="c1"/></spine></package>`,
    );
    zip.file('OEBPS/c1.xhtml', '<html><body><p>פרק ראשון</p></body></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    const info = await describeBook(mkBook('epub-1', '.epub', buffer));
    expect(info.description).toContain('תיאור אמיתי של הספר');
    expect(info.description).not.toContain('<b>');
    expect(info.publisher).toBe('הוצאה');
    expect(info.year).toBe('2019');
  });

  it('falls back to the first chapter when an EPUB has no annotation', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      '<?xml version="1.0"?><container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>',
    );
    zip.file(
      'content.opf',
      `<?xml version="1.0"?><package><metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">ספר</dc:title></metadata>
       <manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>
       <spine><itemref idref="c1"/></spine></package>`,
    );
    zip.file(
      'c1.xhtml',
      '<html><body><h1>פרק ראשון</h1><p>הפסקה הפותחת של הספר הזה ארוכה מספיק כדי לשמש כתיאור במסך פרטי הספר.</p></body></html>',
    );
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const info = await describeBook(mkBook('epub-2', '.epub', buffer));
    expect(info.description).toContain('הפסקה הפותחת');
    expect(info.description).not.toContain('פרק ראשון');
  });

  it('reads an FB2 annotation without the surrounding markup', async () => {
    const fb2 = `<?xml version="1.0" encoding="utf-8"?>
      <FictionBook><description><title-info><book-title>ספר</book-title>
      <annotation><p>ההערה של הספר הזה.</p></annotation></title-info></description>
      <body><section><p>טקסט</p></section></body></FictionBook>`;
    const info = await describeBook(mkBook('fb2-1', '.fb2', enc(fb2)));
    expect(info.description).toBe('ההערה של הספר הזה.');
  });

  it('takes the opening of a plain text file', async () => {
    const txt = 'הכותרת\n\nהפסקה הראשונה של הקובץ הזה מספרת על משהו שקרה לפני שנים רבות, במקום רחוק.';
    const info = await describeBook(mkBook('txt-1', '.txt', enc(txt)));
    expect(info.description).toContain('הפסקה הראשונה');
  });
});
