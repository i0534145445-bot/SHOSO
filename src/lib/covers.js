/**
 * Cover art extraction.
 *
 * ReadEra always shows the book's own cover when the file carries one, and only
 * falls back to a made-up thumbnail when it doesn't. SHOSO used to skip this
 * step entirely (every book had `cover: null`), which is why "some files don't
 * show a cover image". This module pulls the real artwork out of the file:
 *
 *   EPUB – the OPF cover (meta name="cover", properties="cover-image", or a
 *          manifest image whose name looks like a cover)
 *   FB2  – <coverpage><image xlink:href="#id"/> + the matching <binary>
 *   PDF  – the first page rendered to a canvas
 *   HTML/MD/TXT – no embedded art, so the caller keeps the generated cover
 */

import { readBookBuffer } from './platform.js';
import { extOf, loadPdf } from './parsers.js';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
};

const mimeOf = (path) => MIME[(extOf(path).slice(1) || 'jpg').toLowerCase()] || 'image/jpeg';

/** Cache: bookId -> data URL | null (null = the file has no cover art). */
const cache = new Map();
const pending = new Map();

export const cachedCover = (id) => cache.get(id) || null;

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

/** Shrink to a sane thumbnail size so covers stay cheap to hold in memory. */
const downscale = (dataUrl, maxW = 400) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
        const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

/* ------------------------------------------------------------------ */
/* EPUB                                                                */
/* ------------------------------------------------------------------ */

async function epubCover(buffer) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  const container = zip.file('META-INF/container.xml');
  let opfPath = null;
  if (container) {
    const m = /full-path="([^"]+)"/.exec(await container.async('string'));
    if (m) opfPath = m[1];
  }
  if (!opfPath) opfPath = Object.keys(zip.files).find((n) => n.endsWith('.opf')) || null;
  if (!opfPath) return null;

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) return null;

  // manifest id -> href
  const items = new Map();
  for (const m of opfXml.matchAll(/<item\b[^>]*>/g)) {
    const tag = m[0];
    const id = /id="([^"]+)"/.exec(tag)?.[1];
    const href = /href="([^"]+)"/.exec(tag)?.[1];
    if (id && href) items.set(id, { href, tag });
  }

  let href = null;

  // 1) <meta name="cover" content="id"/>
  const metaId = /<meta[^>]+name="cover"[^>]+content="([^"]+)"/i.exec(opfXml)?.[1]
    || /<meta[^>]+content="([^"]+)"[^>]+name="cover"/i.exec(opfXml)?.[1];
  if (metaId && items.has(metaId)) href = items.get(metaId).href;

  // 2) properties="cover-image"
  if (!href) {
    for (const [, item] of items) {
      if (/properties="[^"]*cover-image[^"]*"/.test(item.tag)) { href = item.href; break; }
    }
  }

  // 3) any image whose path mentions "cover"
  if (!href) {
    for (const [, item] of items) {
      if (IMAGE_EXT.test(item.href) && /cover/i.test(item.href)) { href = item.href; break; }
    }
  }

  // 4) first image in the manifest
  if (!href) {
    for (const [, item] of items) {
      if (IMAGE_EXT.test(item.href)) { href = item.href; break; }
    }
  }
  if (!href) return null;

  const candidates = [opfDir + href, href, decodeURIComponent(opfDir + href)];
  for (const path of candidates) {
    const file = zip.file(path);
    if (!file) continue;
    const blob = await file.async('blob');
    const typed = blob.slice(0, blob.size, mimeOf(path));
    return blobToDataUrl(typed);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* FB2                                                                 */
/* ------------------------------------------------------------------ */

async function fb2Cover(buffer) {
  const xml = new TextDecoder('utf-8').decode(buffer);
  const href = /<coverpage[\s\S]*?<image[^>]*(?:xlink:)?href="#([^"]+)"/i.exec(xml)?.[1];
  if (!href) return null;

  const esc = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const binary = new RegExp(`<binary[^>]*id="${esc}"[^>]*>([\\s\\S]*?)</binary>`, 'i').exec(xml)?.[1];
  if (!binary) return null;

  const contentType = /<binary[^>]*content-type="([^"]+)"/i.exec(xml)?.[1] || 'image/jpeg';
  const base64 = binary.replace(/\s+/g, '');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return blobToDataUrl(new Blob([bytes], { type: contentType }));
}

/* ------------------------------------------------------------------ */
/* PDF – first page as the cover                                       */
/* ------------------------------------------------------------------ */

async function pdfCover(buffer) {
  const pdf = await loadPdf(buffer);
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2, 420 / viewport.width);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(scaled.width);
  canvas.height = Math.round(scaled.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise;
  return canvas.toDataURL('image/jpeg', 0.8);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function extractCover(buffer, ext) {
  if (!buffer) return null;
  try {
    let raw = null;
    if (ext === '.epub') raw = await epubCover(buffer);
    else if (ext === '.fb2') raw = await fb2Cover(buffer);
    else if (ext === '.pdf') raw = await pdfCover(buffer);
    if (!raw) return null;
    return await downscale(raw);
  } catch {
    return null;
  }
}

/** Resolve a book's cover, extracting it from the file the first time. */
export async function coverFor(book) {
  if (!book) return null;
  if (book.cover) return book.cover;
  if (cache.has(book.id)) return cache.get(book.id);
  if (pending.has(book.id)) return pending.get(book.id);

  const job = (async () => {
    try {
      const buffer = await readBookBuffer(book);
      const dataUrl = await extractCover(buffer, extOf(book.fileName || book.path || ''));
      cache.set(book.id, dataUrl);
      return dataUrl;
    } catch {
      cache.set(book.id, null);
      return null;
    } finally {
      pending.delete(book.id);
    }
  })();

  pending.set(book.id, job);
  return job;
}
