/**
 * Book description ("annotation") extraction – the text ReadEra shows on the
 * About‑document screen, between selecting a book and opening it.
 *
 *   EPUB – <dc:description> (plus dc:publisher / dc:date / belongs-to-collection)
 *          and, when the file carries no annotation, the opening of chapter 1
 *   FB2  – <annotation> inside <title-info>, plus <publisher>/<year>/<sequence>
 *   PDF  – the document's metadata and the first page's text
 *   TXT / MD / HTML – the first real paragraph after the title
 *
 * Every result is memoised per book, because the screen is opened over and over
 * and unzipping an EPUB each time would be wasteful.
 */

import { readBookBuffer } from './platform.js';
import { extOf } from './parsers.js';

const MAX_CHARS = 1200;

const cache = new Map();

export const cachedDescription = (id) => (cache.has(id) ? cache.get(id) : null);

const decodeText = (buffer) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('windows-1255').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
};

const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&lt;': '<', '&gt;': '>', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&laquo;': '«', '&raquo;': '»',
};

export const plainText = (html) => String(html || '')
  .replace(/<\s*(br|hr)\s*\/?>/gi, '\n')
  .replace(/<\/\s*(p|div|h[1-6]|li|blockquote|section)\s*>/gi, '\n')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{2,}/g, '\n')
  .trim();

const clip = (text, max = MAX_CHARS) => {
  const clean = plainText(text).replace(/\n+/g, '\n').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return `${(stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim()}…`;
};

/**
 * The opening paragraphs of a book, used when the file has no annotation of its
 * own. The title line, chapter headings and one-word lines are skipped so the
 * excerpt reads like prose rather than a table of contents.
 */
export const openingExcerpt = (text, max = 520) => {
  const lines = plainText(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const paragraphs = lines.filter((l) => l.length >= 60 || /\s/.test(l) && l.length >= 40);
  const body = paragraphs.length ? paragraphs : lines;
  return clip(body.slice(0, 4).join(' '), max);
};

const result = (description, extra = {}) => ({
  description: clip(description || ''),
  publisher: extra.publisher || '',
  year: extra.year || '',
  series: extra.series || '',
});

/* ------------------------------- EPUB ------------------------------- */

const xmlDoc = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

const tagText = (doc, ...names) => {
  for (const name of names) {
    const el = doc.getElementsByTagName(name)[0] || doc.getElementsByTagName(name.split(':').pop())[0];
    if (el && el.textContent.trim()) return el.textContent.trim();
  }
  return '';
};

const metaValue = (doc, property) => {
  const metas = [...doc.getElementsByTagName('meta')];
  const hit = metas.find((m) => (m.getAttribute('property') || m.getAttribute('name') || '') === property);
  return hit ? (hit.getAttribute('content') || hit.textContent || '').trim() : '';
};

async function epubDescription(buffer) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  const containerFile = zip.file('META-INF/container.xml');
  let opfPath = null;
  if (containerFile) {
    const m = /full-path="([^"]+)"/.exec(await containerFile.async('string'));
    if (m) opfPath = m[1];
  }
  if (!opfPath) opfPath = names.find((n) => n.endsWith('.opf')) || null;
  if (!opfPath || !zip.file(opfPath)) return result('');

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const doc = xmlDoc(await zip.file(opfPath).async('string'));

  const annotation = tagText(doc, 'dc:description', 'description');
  const publisher = tagText(doc, 'dc:publisher', 'publisher');
  const year = (tagText(doc, 'dc:date', 'date').match(/\d{4}/) || [''])[0];
  const series = metaValue(doc, 'belongs-to-collection') || tagText(doc, 'dc:subject');

  if (annotation) return result(annotation, { publisher, year, series });

  // No annotation in the package file – open the first spine document instead.
  const manifest = [...doc.querySelectorAll('manifest > item')];
  const spine = [...doc.querySelectorAll('spine > itemref')].map((r) => r.getAttribute('idref'));
  const firstId = spine.find(Boolean);
  const item = manifest.find((i) => i.getAttribute('id') === firstId) || manifest.find((i) => /\.x?html?$/i.test(i.getAttribute('href') || ''));
  const href = item?.getAttribute('href');
  if (!href) return result('', { publisher, year, series });
  const file = zip.file(opfDir + decodeURIComponent(href));
  if (!file) return result('', { publisher, year, series });
  const html = await file.async('string');
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return result(openingExcerpt(body ? body[1] : html), { publisher, year, series });
}

/* -------------------------------- FB2 -------------------------------- */

function fb2Description(text) {
  const doc = xmlDoc(text);
  const titleInfo = doc.getElementsByTagName('title-info')[0] || doc;
  const annotationEl = titleInfo.getElementsByTagName('annotation')[0] || doc.getElementsByTagName('annotation')[0];
  const annotation = annotationEl ? annotationEl.textContent : '';
  const publisher = tagText(doc, 'publisher');
  const year = (tagText(doc, 'year').match(/\d{4}/) || [''])[0];
  const sequence = doc.getElementsByTagName('sequence')[0];
  const series = sequence ? sequence.getAttribute('name') || '' : '';
  if (annotation.trim()) return result(annotation, { publisher, year, series });
  const body = doc.getElementsByTagName('body')[0];
  return result(body ? openingExcerpt(body.textContent) : '', { publisher, year, series });
}

/* -------------------------------- PDF -------------------------------- */

async function pdfDescription(buffer) {
  const { loadPdf } = await import('./parsers.js');
  const doc = await loadPdf(buffer);
  let description = '';
  let publisher = '';
  let year = '';
  try {
    const meta = await doc.getMetadata();
    const info = meta?.info || {};
    publisher = info.Publisher || '';
    year = (String(info.CreationDate || info.ModDate || '').match(/\d{4}/) || [''])[0];
    description = info.Description || info.Subject || '';
  } catch { /* metadata is optional */ }
  if (!description) {
    try {
      const page = await doc.getPage(1);
      const content = await page.getTextContent();
      description = openingExcerpt(content.items.map((i) => i.str).join(' '));
    } catch { /* keep it empty */ }
  }
  return result(description, { publisher, year });
}

/* --------------------------- text formats --------------------------- */

const textDescription = (buffer, ext) => {
  const raw = decodeText(buffer);
  if (ext === '.html' || ext === '.htm') {
    const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(raw);
    return result(openingExcerpt(body ? body[1] : raw));
  }
  if (ext === '.md') {
    return result(openingExcerpt(raw.replace(/^#{1,6}\s.*$/gm, '')));
  }
  return result(openingExcerpt(raw));
};

/* -------------------------------- API -------------------------------- */

export async function describeBook(book) {
  if (!book) return result('');
  if (cache.has(book.id)) return cache.get(book.id);
  const ext = (book.ext || extOf(book.fileName) || '').toLowerCase();
  let info = result('');
  try {
    const buffer = await readBookBuffer(book);
    if (ext === '.epub') info = await epubDescription(buffer);
    else if (ext === '.fb2') info = fb2Description(decodeText(buffer));
    else if (ext === '.pdf') info = await pdfDescription(buffer);
    else info = textDescription(buffer, ext);
  } catch (err) {
    info = result('');
    // A broken file must not break the screen – the UI shows the fallback copy.
    if (typeof console !== 'undefined') console.warn('description unavailable', book?.id, err?.message);
  }
  cache.set(book.id, info);
  return info;
}

/** The reader's word count → a "time to read" line, like ReadEra shows. */
export const readingMinutes = (wordCount) => (wordCount > 0 ? Math.max(1, Math.round(wordCount / 200)) : 0);
