/**
 * Book parsers – turn raw file bytes into readable chapters.
 *
 * Supports: EPUB (via JSZip + OPF/NCX/nav), PDF (via pdfjs-dist),
 * FB2 (XML), TXT (plain text), HTML/HTM, Markdown.
 * MOBI/DJVU are detected but not parsed (native formats need a dedicated
 * engine – the library still lists them with a graceful message).
 */

import { escapeHtml, detectDirection } from './format.js';

/**
 * JSZip is ~95 kB and is only needed once an EPUB is actually opened, so it is
 * pulled in on demand instead of riding along with the first paint. The boot
 * bundle stays small and the unzip chunk is cached by the renderer.
 */
let zipModule = null;
const loadZip = async () => {
  if (!zipModule) zipModule = (await import('jszip')).default;
  return zipModule;
};

export const SUPPORTED_EXT = new Set(['.epub', '.pdf', '.txt', '.fb2', '.html', '.htm', '.md']);
export const DETECTED_ONLY_EXT = new Set(['.mobi', '.djvu']);

export const extOf = (nameOrPath) => {
  const m = /\.([a-z0-9]+)$/i.exec(String(nameOrPath || ''));
  return m ? `.${m[1].toLowerCase()}` : '';
};

export const isSupported = (nameOrPath) => SUPPORTED_EXT.has(extOf(nameOrPath));

export const countWords = (text) => (String(text || '').match(/\S+/g) || []).length;

export const estimateMinutes = (text, wpm = 200) => Math.max(1, Math.round(countWords(text) / wpm));

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

const decodeText = (buffer) => {
  // Try UTF-8 first, fall back to Windows-1255 (common for Hebrew TXT files).
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return text;
  } catch {
    try {
      return new TextDecoder('windows-1255').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
};

const normalizeNewlines = (text) => String(text || '').replace(/\r\n?/g, '\n');

/** Split plain text into chapters on common headings. */
export function splitTextChapters(rawText) {
  const text = normalizeNewlines(rawText).trim();
  if (!text) return [{ id: 'ch-0', title: 'תחילת הספר', html: '' }];
  const lines = text.split('\n');
  const headingRx = /^\s*(פרק|שער|חלק|Chapter|CHAPTER|PART|קפיטל|פרק|סימן)\s+(\S.*)?$/i;
  const chapters = [];
  let current = { id: 'ch-0', title: 'פתיחה', paragraphs: [] };
  let idx = 0;
  const flush = () => {
    if (current.paragraphs.length || chapters.length === 0) {
      const html = current.paragraphs
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('\n');
      chapters.push({ id: current.id, title: current.title, html, text: current.paragraphs.join('\n\n') });
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (headingRx.test(trimmed) && trimmed.length < 80) {
      flush();
      idx += 1;
      current = { id: `ch-${idx}`, title: trimmed, paragraphs: [] };
      continue;
    }
    if (!trimmed) {
      // blank line = paragraph break (handled by grouping below)
      current.paragraphs.push('');
      continue;
    }
    current.paragraphs.push(trimmed);
  }
  flush();
  // Merge empty paragraphs, drop empties
  const cleaned = chapters
    .map((c) => ({
      ...c,
      html: c.html.replace(/<p><\/p>/g, ''),
    }))
    .filter((c) => c.html.trim());
  return cleaned.length ? cleaned : [{ id: 'ch-0', title: 'תחילת הספר', html: `<p>${escapeHtml(text.slice(0, 5000))}</p>` }];
}

export function parseTxt(buffer) {
  const text = decodeText(buffer);
  const chapters = splitTextChapters(text);
  return {
    format: 'TXT',
    title: '',
    author: '',
    language: detectDirection(text) === 'rtl' ? 'he' : 'en',
    direction: detectDirection(text),
    chapters,
    toc: chapters.map((c) => ({ id: c.id, title: c.title })),
    wordCount: countWords(text),
  };
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

function cleanHtml(html) {
  // Remove scripts/styles, keep body content, strip event handlers.
  let out = String(html || '');
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(out);
  if (bodyMatch) out = bodyMatch[1];
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/<a\s+[^>]*href\s*=\s*"(javascript:[^"]*)"[^>]*>/gi, '<a>');
  return out.trim();
}

export function parseHtml(buffer) {
  const text = decodeText(buffer);
  const html = cleanHtml(text);
  // Split on h1/h2 into chapters when present.
  const parts = html.split(/(<h[12][^>]*>[\s\S]*?<\/h[12]>)/i).filter(Boolean);
  const chapters = [];
  let current = { id: 'ch-0', title: 'תחילת הספר', html: '' };
  let idx = 0;
  const flush = () => {
    if (current.html.trim()) chapters.push({ id: current.id, title: current.title, html: current.html });
  };
  for (const part of parts) {
    const h = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/i.exec(part);
    if (h) {
      flush();
      idx += 1;
      const title = h[1].replace(/<[^>]+>/g, '').trim() || `פרק ${idx}`;
      current = { id: `ch-${idx}`, title, html: part };
    } else {
      current.html += part;
    }
  }
  flush();
  const finalChapters = chapters.length ? chapters : [{ id: 'ch-0', title: 'תחילת הספר', html: `<div>${html}</div>` }];
  const plain = text.replace(/<[^>]+>/g, ' ');
  return {
    format: 'HTML',
    title: '',
    author: '',
    language: detectDirection(plain) === 'rtl' ? 'he' : 'en',
    direction: detectDirection(plain),
    chapters: finalChapters,
    toc: finalChapters.map((c) => ({ id: c.id, title: c.title })),
    wordCount: countWords(plain),
  };
}

/* ------------------------------------------------------------------ */
/* Markdown (minimal, safe)                                            */
/* ------------------------------------------------------------------ */

export function markdownToHtml(md) {
  const lines = normalizeNewlines(md).split('\n');
  const out = [];
  let inList = false;
  let inCode = false;
  let codeBuf = [];
  const inline = (s) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      if (inList) { out.push('</ul>'); inList = false; }
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (inList && line.trim()) { out.push('</ul>'); inList = false; }
    if (!line.trim()) continue;
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  return out.join('\n');
}

export function parseMarkdown(buffer) {
  const text = decodeText(buffer);
  const html = markdownToHtml(text);
  // Split chapters on h1/h2
  const parts = html.split(/(<h[12]>[\s\S]*?<\/h[12]>)/i).filter(Boolean);
  const chapters = [];
  let current = { id: 'ch-0', title: 'תחילת הספר', html: '' };
  let idx = 0;
  const flush = () => { if (current.html.trim()) chapters.push({ id: current.id, title: current.title, html: current.html }); };
  for (const part of parts) {
    const h = /<h[12]>([\s\S]*?)<\/h[12]>/i.exec(part);
    if (h) {
      flush();
      idx += 1;
      current = { id: `ch-${idx}`, title: h[1].replace(/<[^>]+>/g, '').trim() || `פרק ${idx}`, html: part };
    } else {
      current.html += part;
    }
  }
  flush();
  const finalChapters = chapters.length ? chapters : [{ id: 'ch-0', title: 'תחילת הספר', html }];
  return {
    format: 'MD',
    title: '',
    author: '',
    language: detectDirection(text) === 'rtl' ? 'he' : 'en',
    direction: detectDirection(text),
    chapters: finalChapters,
    toc: finalChapters.map((c) => ({ id: c.id, title: c.title })),
    wordCount: countWords(text),
  };
}

/* ------------------------------------------------------------------ */
/* FB2                                                                 */
/* ------------------------------------------------------------------ */

export function parseFb2(buffer) {
  const text = decodeText(buffer);
  const title = (/<book-title>([\s\S]*?)<\/book-title>/i.exec(text) || [])[1]?.trim() || '';
  const first = (/<first-name>([\s\S]*?)<\/first-name>/i.exec(text) || [])[1]?.trim() || '';
  const last = (/<last-name>([\s\S]*?)<\/last-name>/i.exec(text) || [])[1]?.trim() || '';
  const author = [first, last].filter(Boolean).join(' ').trim();
  const lang = (/<lang>([\s\S]*?)<\/lang>/i.exec(text) || [])[1]?.trim() || '';

  // Extract body sections
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(text);
  const body = bodyMatch ? bodyMatch[1] : text;
  const sectionRx = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  const sections = [];
  let m;
  while ((m = sectionRx.exec(body)) !== null) {
    sections.push(m[1]);
  }
  // FB2 keeps every picture in a base64 <binary> block; without this the cover
  // (an <image> on the first page) simply vanished.
  const binaries = new Map();
  const binRx = /<binary\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/binary>/gi;
  let bin;
  while ((bin = binRx.exec(text)) !== null) {
    const meta = bin[0].slice(0, bin[0].indexOf('>'));
    const type = (/content-type=["']([^"']+)["']/i.exec(meta) || [])[1] || 'image/jpeg';
    const data = bin[2].replace(/\s+/g, '');
    if (data) binaries.set(bin[1], `data:${type};base64,${data}`);
  }
  const fb2ToHtml = (xml) => {
    let out = xml;
    // Pictures travel through the tag stripper below as placeholders.
    const pictures = [];
    out = out.replace(/<image\b[^>]*?\b(?:l:href|href)=["']#([^"']+)["'][^>]*\/?>/gi, (_m, id) => {
      if (!binaries.has(id)) return '';
      pictures.push(binaries.get(id));
      return `\u0000pic${pictures.length - 1}\u0000`;
    });
    out = out.replace(/<title>([\s\S]*?)<\/title>/gi, (_m, inner) => {
      const t = inner.replace(/<[^>]+>/g, '').trim();
      return t ? `<h2>${escapeHtml(t)}</h2>` : '';
    });
    out = out.replace(/<subtitle>([\s\S]*?)<\/subtitle>/gi, (_m, inner) => `<h3>${escapeHtml(inner.replace(/<[^>]+>/g, '').trim())}</h3>`);
    out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner) => `<p>${inner.replace(/<[^>]+>/g, (tag) => (/^(<br|<\/p|<p)/i.test(tag) ? tag : '')).trim() ? inner : ''}</p>`);
    out = out.replace(/<empty-line\s*\/>/gi, '<br/>');
    out = out.replace(/<v>([\s\S]*?)<\/v>/gi, (_m, inner) => `<p>${escapeHtml(inner.replace(/<[^>]+>/g, '').trim())}</p>`);
    out = out.replace(/<emphasis>([\s\S]*?)<\/emphasis>/gi, '<em>$1</em>');
    out = out.replace(/<strong>([\s\S]*?)<\/strong>/gi, '<strong>$1</strong>');
    out = out.replace(/<strikethrough>([\s\S]*?)<\/strikethrough>/gi, '<s>$1</s>');
    out = out.replace(/<image[^>]*\/>/gi, '');
    out = out.replace(/<[^>]+>/g, '');
    out = out.replace(/\u0000pic(\d+)\u0000/g, (_m, i) => `<img src="${pictures[Number(i)]}" alt="" />`);
    // Re-wrap: split on newlines into paragraphs where needed
    return out;
  };
  const chapters = [];
  if (sections.length) {
    sections.forEach((sec, i) => {
      const rawTitle = (/<title>([\s\S]*?)<\/title>/i.exec(sec) || [])[1]?.replace(/<[^>]+>/g, '').trim();
      const html = fb2ToHtml(sec);
      chapters.push({ id: `ch-${i}`, title: rawTitle || `פרק ${i + 1}`, html });
    });
  } else {
    // Fallback: whole body as one chapter
    chapters.push({ id: 'ch-0', title: title || 'תחילת הספר', html: fb2ToHtml(body) });
  }
  const plain = text.replace(/<[^>]+>/g, ' ');
  return {
    format: 'FB2',
    title,
    author,
    language: lang || (detectDirection(plain) === 'rtl' ? 'he' : 'en'),
    direction: detectDirection(plain),
    chapters,
    toc: chapters.map((c) => ({ id: c.id, title: c.title })),
    wordCount: countWords(plain),
  };
}

/* ------------------------------------------------------------------ */
/* EPUB                                                                */
/* ------------------------------------------------------------------ */

const xmlToDoc = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

/**
 * Resolve `..` and `.` inside a zip path. Inside an EPUB every chapter sits in
 * its own folder and refers to artwork as "../Images/cover.jpg"; without this
 * those references never matched a file and the picture stayed blank.
 */
export function normalizeZipPath(path) {
  const parts = [];
  String(path || '').split('/').forEach((seg) => {
    if (!seg || seg === '.') return;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  });
  return parts.join('/');
}

function opfText(doc, tag) {
  // tag may be 'dc:title' (namespaced) or plain 'title'
  const byName = doc.getElementsByTagName(tag)[0];
  if (byName) return byName.textContent.trim();
  const local = tag.includes(':') ? tag.split(':')[1] : tag;
  const els = doc.getElementsByTagName(local);
  if (els && els.length) return els[0].textContent.trim();
  return '';
}

export async function parseEpub(buffer) {
  const JSZip = await loadZip();
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);

  // container.xml
  let opfPath = null;
  const containerFile = zip.file('META-INF/container.xml');
  if (containerFile) {
    const containerXml = await containerFile.async('string');
    const m = /full-path="([^"]+)"/.exec(containerXml);
    if (m) opfPath = m[1];
  }
  if (!opfPath) {
    opfPath = names.find((n) => n.endsWith('.opf')) || null;
  }
  if (!opfPath || !zip.file(opfPath)) {
    throw new Error('קובץ EPUB לא תקין – לא נמצא קובץ OPF');
  }
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = await zip.file(opfPath).async('string');
  const opfDoc = xmlToDoc(opfXml);

  const title = opfText(opfDoc, 'dc:title') || opfText(opfDoc, 'title');
  const author = opfText(opfDoc, 'dc:creator') || opfText(opfDoc, 'creator');
  const language = opfText(opfDoc, 'dc:language') || opfText(opfDoc, 'language');

  // manifest: id -> href, media-type
  const manifest = new Map();
  const manifestEl = opfDoc.querySelector('manifest');
  if (manifestEl) {
    manifestEl.querySelectorAll('item').forEach((item) => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type') || '';
      if (id && href) manifest.set(id, { href, mediaType });
    });
  }

  // spine order
  const spineIds = [];
  const spineEl = opfDoc.querySelector('spine');
  if (spineEl) {
    spineEl.querySelectorAll('itemref').forEach((ref) => {
      const idref = ref.getAttribute('idref');
      if (idref) spineIds.push(idref);
    });
  }

  // TOC: prefer nav (EPUB3), fall back to NCX (EPUB2)
  let toc = [];
  const navItem = [...manifest.values()].find((v) => /nav/i.test(v.href) || v.mediaType.includes('nav'));
  const ncxItem = [...manifest.values()].find((v) => v.href.endsWith('.ncx') || v.mediaType.includes('ncx'));
  const resolveHref = (href) => {
    try { return opfDir + decodeURIComponent(href); } catch { return opfDir + href; }
  };
  if (navItem && zip.file(resolveHref(navItem.href))) {
    try {
      const navXml = await zip.file(resolveHref(navItem.href)).async('string');
      const navDoc = new DOMParser().parseFromString(navXml, 'application/xhtml+xml');
      navDoc.querySelectorAll('nav a, ol a, ul a').forEach((a) => {
        const href = a.getAttribute('href');
        const label = a.textContent.trim();
        if (href && label) toc.push({ href: href.split('#')[0], anchor: href.includes('#') ? href.split('#')[1] : '', title: label });
      });
    } catch { /* fall through to NCX */ }
  }
  if (!toc.length && ncxItem && zip.file(resolveHref(ncxItem.href))) {
    try {
      const ncxXml = await zip.file(resolveHref(ncxItem.href)).async('string');
      const ncxDoc = xmlToDoc(ncxXml);
      ncxDoc.querySelectorAll('navMap navLabel').forEach((label) => {
        const text = label.querySelector('text')?.textContent.trim();
        const content = label.parentElement?.querySelector('content')?.getAttribute('src') || '';
        if (text && content) toc.push({ href: content.split('#')[0], anchor: content.includes('#') ? content.split('#')[1] : '', title: text });
      });
    } catch { /* ignore */ }
  }

  // Images: build blob URL map for <img src> rewriting
  const imageUrls = new Map();
  for (const [id, item] of manifest) {
    if (/^image\//i.test(item.mediaType)) {
      const full = resolveHref(item.href);
      const file = zip.file(full);
      if (file) {
        const blob = await file.async('blob');
        // One object URL per image, referenced under every alias it can be
        // addressed by – three separate URLs would triple the blob memory and
        // never be revoked.
        const url = URL.createObjectURL(blob);
        imageUrls.set(item.href, url);
        imageUrls.set(full, url);
        imageUrls.set(id, url);
      }
    }
  }

  const imageCandidates = (href, opfDir, chapterPath) => {
    const chapterDir = chapterPath.slice(0, chapterPath.lastIndexOf('/') + 1);
    return [
      href,
      normalizeZipPath(href),
      normalizeZipPath(opfDir + href),
      normalizeZipPath(chapterDir + href),
      opfDir + href,
      chapterDir + href,
    ];
  };

  // Chapters from spine. The zip deflate step is I/O- and CPU-bound per file,
  // so all spine documents are decompressed concurrently and then assembled in
  // reading order – a 300-chapter book opens several times faster.
  const spineDocs = [];
  const seen = new Set();
  for (const idref of spineIds) {
    const item = manifest.get(idref);
    if (!item || !item.href) continue;
    const full = resolveHref(item.href);
    if (seen.has(full)) continue;
    seen.add(full);
    const file = zip.file(full);
    if (file) spineDocs.push({ item, full, file });
  }

  const spineXml = await Promise.all(
    spineDocs.map(({ file }) => file.async('string').catch(() => null)),
  );

  const chapters = [];
  for (let si = 0; si < spineDocs.length; si += 1) {
    const { item, full } = spineDocs[si];
    const xhtml = spineXml[si];
    if (!xhtml) continue;
    const doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
    // Title: first h1/h2 or <title>
    let chTitle = doc.querySelector('h1, h2')?.textContent.trim() || doc.querySelector('title')?.textContent.trim() || '';
    // Clean: remove scripts/styles, rewrite img src to blob URLs
    doc.querySelectorAll('script, style').forEach((el) => el.remove());
    doc.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || img.getAttribute('xlink:href') || '';
      if (!src || /^data:/.test(src) || /^https?:/.test(src)) return;
      const decoded = (() => { try { return decodeURIComponent(src); } catch { return src; } })();
      const candidates = imageCandidates(decoded, opfDir, full);
      const hit = candidates.find((c) => imageUrls.has(c));
      if (hit) img.setAttribute('src', imageUrls.get(hit));
      img.removeAttribute('xlink:href');
    });
    // Cover pages are often an <svg><image xlink:href="…"/></svg> wrapper.
    doc.querySelectorAll('image').forEach((node) => {
      const src = node.getAttribute('xlink:href') || node.getAttribute('href') || '';
      if (!src || /^data:/.test(src) || /^https?:/.test(src)) return;
      const decoded = (() => { try { return decodeURIComponent(src); } catch { return src; } })();
      const hit = imageCandidates(decoded, opfDir, full).find((c) => imageUrls.has(c));
      if (hit) {
        const url = imageUrls.get(hit);
        node.setAttribute('href', url);
        node.setAttribute('xlink:href', url);
      }
    });
    const body = doc.querySelector('body');
    const html = body ? body.innerHTML : doc.documentElement.innerHTML;
    // TOC title lookup
    const tocEntry = toc.find((t) => t.href === item.href || full.endsWith(t.href));
    if (tocEntry && tocEntry.title) chTitle = tocEntry.title;
    if (!chTitle) chTitle = `פרק ${chapters.length + 1}`;
    chapters.push({ id: `ch-${chapters.length}`, href: item.href, title: chTitle, html });
  }

  if (!chapters.length) {
    throw new Error('לא נמצאו פרקים ב-EPUB');
  }
  if (!toc.length) {
    toc = chapters.map((c) => ({ href: c.href, title: c.title }));
  }

  const allText = chapters.map((c) => c.html.replace(/<[^>]+>/g, ' ')).join(' ');
  return {
    format: 'EPUB',
    title,
    author,
    language,
    direction: detectDirection(allText),
    chapters,
    toc,
    wordCount: countWords(allText),
    imageUrls,
  };
}

/* ------------------------------------------------------------------ */
/* PDF (pdfjs-dist)                                                    */
/* ------------------------------------------------------------------ */

let pdfjsLib = null;
let pdfWorkerUrl = null;

async function getPdfLib() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import('pdfjs-dist/build/pdf.mjs');
  pdfjsLib = mod && mod.getDocument ? mod : mod.default;
  try {
    const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfWorkerUrl = workerMod.default || workerMod;
  } catch {
    pdfWorkerUrl = null;
  }
  if (pdfWorkerUrl && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  return pdfjsLib;
}

export async function loadPdf(buffer) {
  const lib = await getPdfLib();
  const data = new Uint8Array(buffer);
  const task = lib.getDocument({ data });
  const pdf = await task.promise;
  const meta = await pdf.getMetadata().catch(() => null);
  const info = meta?.info || {};
  const outline = await pdf.getOutline().catch(() => null);
  return {
    pdf,
    pageCount: pdf.numPages,
    title: info.Title || '',
    author: info.Author || '',
    outline: outline || [],
  };
}

export async function renderPdfPage(pdf, pageNum, canvas, scale = 1.5) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}

export async function pdfPageText(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  return content.items.map((it) => it.str).join(' ');
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export async function parseBookBuffer(buffer, ext) {
  const e = ext.toLowerCase();
  if (e === '.epub') return parseEpub(buffer);
  if (e === '.fb2') return parseFb2(buffer);
  if (e === '.txt') return parseTxt(buffer);
  if (e === '.html' || e === '.htm') return parseHtml(buffer);
  if (e === '.md') return parseMarkdown(buffer);
  if (e === '.pdf') {
    const loaded = await loadPdf(buffer);
    return {
      format: 'PDF',
      title: loaded.title,
      author: loaded.author,
      language: '',
      direction: 'ltr',
      pdf: loaded.pdf,
      pageCount: loaded.pageCount,
      outline: loaded.outline,
      chapters: [],
      toc: [],
      wordCount: 0,
    };
  }
  throw new Error(`פורמט לא נתמך: ${ext}`);
}

/** Search chapters for query, return [{chapterIndex, snippet, matchIndex}] */
export function searchChapters(chapters, query) {
  const q = String(query || '').trim();
  if (!q || !chapters?.length) return [];
  const results = [];
  const lower = q.toLowerCase();
  chapters.forEach((ch, chapterIndex) => {
    const text = ch.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const hay = text.toLowerCase();
    let idx = hay.indexOf(lower);
    let count = 0;
    while (idx !== -1 && count < 20) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(text.length, idx + q.length + 60);
      results.push({
        chapterIndex,
        chapterTitle: ch.title,
        snippet: (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''),
        offset: idx,
      });
      count += 1;
      idx = hay.indexOf(lower, idx + q.length);
    }
  });
  return results;
}
