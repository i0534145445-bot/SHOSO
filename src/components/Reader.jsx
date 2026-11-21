import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useStore, getState, bookById, closeBook, saveProgress, markFinished,
  addBookmark, removeBookmark, updateReader, addReadingTime, toast,
} from '../lib/store.js';
import { readBookBuffer } from '../lib/platform.js';
import { parseBookBuffer, searchChapters, renderPdfPage, loadPdf, DETECTED_ONLY_EXT, extOf } from '../lib/parsers.js';
import { FONT_FAMILIES, COLOR_MODES } from '../lib/store.js';
import {
  IconBack, IconToc, IconSearch, IconBookmark, IconFont, IconTts, IconFullscreen,
  IconClose, IconZoomIn, IconZoomOut, IconPlay, IconPause, IconStop, IconCheck,
  IconMore, IconBars, IconChevron,
} from '../lib/icons.jsx';

/** Readera's colour-mode swatches. */
const MODE_SWATCH = {
  light: { bg: '#fbf7ef', fg: '#3b3833' },
  sepia: { bg: '#f7e0c7', fg: '#5b4632' },
  dark: { bg: '#101a1e', fg: '#a9b6ba' },
  night: { bg: '#000000', fg: '#8d8981' },
  console: { bg: '#050809', fg: '#3fd15c' },
};

const TTS_RATES = [0.75, 1, 1.25, 1.5, 2];

export default function Reader() {
  const currentBookId = useStore((s) => s.currentBookId);
  const readerSettings = useStore((s) => s.reader);
  const bookmarks = useStore((s) => s.bookmarks[currentBookId] || []);
  const book = bookById(currentBookId);

  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null); // 'toc' | 'search' | 'bookmarks' | 'settings' | null
  const [uiVisible, setUiVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [percent, setPercent] = useState(0);
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1 });
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfZoom, setPdfZoom] = useState(1.5);
  const [tts, setTts] = useState({ playing: false, rate: 1 });
  const [ttsText, setTtsText] = useState('');

  const scrollRef = useRef(null);
  const chapterRefs = useRef([]);
  const pdfCanvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const saveTimer = useRef(null);
  const readingStart = useRef(Date.now());
  const uiTimer = useRef(null);

  /* ---------- load book ---------- */
  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setParsed(null);
    readingStart.current = Date.now();
    (async () => {
      try {
        const ext = book.ext || extOf(book.fileName);
        if (DETECTED_ONLY_EXT.has(ext)) {
          throw new Error(`הפורמט ${book.format} נתמך בזיהוי בלבד בגרסה זו. נסה להמיר את הספר ל-EPUB או PDF.`);
        }
        const buffer = await readBookBuffer(book);
        if (cancelled) return;
        if (ext === '.pdf') {
          const loaded = await loadPdf(buffer);
          if (cancelled) return;
          pdfDocRef.current = loaded.pdf;
          const saved = getState().progress[book.id];
          setPdfPage(saved?.page || 1);
          setParsed({
            format: 'PDF',
            title: loaded.title || book.title,
            author: loaded.author || book.author,
            pageCount: loaded.pageCount,
            outline: loaded.outline,
            direction: 'ltr',
          });
        } else {
          const result = await parseBookBuffer(buffer, ext);
          if (cancelled) return;
          pdfDocRef.current = null;
          const saved = getState().progress[book.id];
          setCurrentChapter(saved?.chapter || 0);
          setPercent(saved?.percent || 0);
          setParsed(result);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'שגיאה בפתיחת הספר');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- restore scroll position ---------- */
  useEffect(() => {
    if (!parsed || parsed.format === 'PDF' || !scrollRef.current) return;
    const saved = getState().progress[book.id];
    if (saved?.scroll) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = saved.scroll;
      });
    }
  }, [parsed?.format]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- PDF rendering ---------- */
  useEffect(() => {
    if (!parsed || parsed.format !== 'PDF' || !pdfDocRef.current || !pdfCanvasRef.current) return;
    let cancelled = false;
    renderPdfPage(pdfDocRef.current, pdfPage, pdfCanvasRef.current, pdfZoom).catch(() => {});
    const pct = Math.round((pdfPage / parsed.pageCount) * 100);
    setPercent(pct);
    saveTimer.current = setTimeout(() => {
      saveProgress(book.id, { page: pdfPage, percent: pct, finished: pct >= 100 });
    }, 500);
    return () => { cancelled = true; clearTimeout(saveTimer.current); };
  }, [parsed?.format, pdfPage, pdfZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- page count (Readera's "3 מתוך 12") ---------- */
  const measurePages = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !parsed || parsed.format === 'PDF') return;
    const pages = Math.max(1, Math.ceil(el.scrollHeight / Math.max(1, el.clientHeight)));
    const page = Math.min(pages, Math.floor(el.scrollTop / Math.max(1, el.clientHeight)) + 1);
    setPageInfo({ page, pages });
  }, [parsed]);

  useEffect(() => {
    measurePages();
    const onResize = () => measurePages();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measurePages, parsed?.format, parsed?.chapters?.length, readerSettings.fontSize, readerSettings.lineHeight, readerSettings.maxWidth, readerSettings.margins]);

  /* ---------- scroll progress (EPUB/TXT/...) ---------- */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !parsed || parsed.format === 'PDF') return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0;
    setPercent(pct);
    // current chapter via refs
    let idx = 0;
    chapterRefs.current.forEach((ref, i) => {
      if (ref && ref.offsetTop <= el.scrollTop + el.clientHeight * 0.3) idx = i;
    });
    setCurrentChapter(idx);
    setPageInfo((prev) => {
      const pages = Math.max(1, Math.ceil(el.scrollHeight / Math.max(1, el.clientHeight)));
      const page = Math.min(pages, Math.floor(el.scrollTop / Math.max(1, el.clientHeight)) + 1);
      return prev.page === page && prev.pages === pages ? prev : { page, pages };
    });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveProgress(book.id, {
        chapter: idx,
        scroll: el.scrollTop,
        percent: pct,
        totalChapters: parsed.chapters?.length || 0,
        finished: pct >= 99,
      });
      if (pct >= 99) markFinished(book.id);
    }, 600);
  }, [parsed, book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- auto-hide UI ---------- */
  const pokeUi = useCallback(() => {
    setUiVisible(true);
    clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => setUiVisible(false), 3500);
  }, []);

  useEffect(() => {
    pokeUi();
    return () => clearTimeout(uiTimer.current);
  }, [pokeUi]);

  /* ---------- reading time ---------- */
  useEffect(() => {
    const iv = setInterval(() => {
      if (book) addReadingTime(book.id, 30);
    }, 30000);
    return () => clearInterval(iv);
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- TTS ---------- */
  const stopTts = useCallback(() => {
    window.speechSynthesis?.cancel();
    setTts((t) => ({ ...t, playing: false }));
  }, []);

  const speakChapter = useCallback((chapterIndex) => {
    if (!parsed || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const ch = parsed.chapters?.[chapterIndex];
    if (!ch) return;
    const text = ch.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = tts.rate;
    utter.lang = parsed.direction === 'rtl' ? 'he-IL' : 'en-US';
    utter.onend = () => setTts((t) => ({ ...t, playing: false }));
    utter.onerror = () => setTts((t) => ({ ...t, playing: false }));
    setTtsText(text.slice(0, 120));
    setTts((t) => ({ ...t, playing: true }));
    window.speechSynthesis.speak(utter);
  }, [parsed, tts.rate]);

  useEffect(() => () => stopTts(), [stopTts]);

  /* ---------- navigation ---------- */
  const goChapter = useCallback((idx) => {
    if (!parsed?.chapters) return;
    const next = Math.min(parsed.chapters.length - 1, Math.max(0, idx));
    setCurrentChapter(next);
    const ref = chapterRefs.current[next];
    if (ref && scrollRef.current) {
      scrollRef.current.scrollTo({ top: ref.offsetTop - 12, behavior: 'smooth' });
    }
  }, [parsed]);

  const pageScroll = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight * 0.9, behavior: 'smooth' });
  }, []);

  /* ---------- search ---------- */
  const runSearch = useCallback(() => {
    if (!parsed?.chapters) return;
    setSearchResults(searchChapters(parsed.chapters, searchQuery));
  }, [parsed, searchQuery]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (typing) return;
      if (e.key === 'Escape') {
        if (panel) setPanel(null);
        else closeBook();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageDown') {
        e.preventDefault();
        if (parsed?.format === 'PDF') setPdfPage((p) => Math.min(parsed.pageCount, p + 1));
        else pageScroll(1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
        e.preventDefault();
        if (parsed?.format === 'PDF') setPdfPage((p) => Math.max(1, p - 1));
        else pageScroll(-1);
      } else if (e.key === 'b' || e.key === 'B') {
        addBookmark(book.id, { chapter: currentChapter, scroll: scrollRef.current?.scrollTop || 0, page: pdfPage });
      } else if (e.key === 't' || e.key === 'T') {
        setPanel((p) => (p === 'toc' ? null : 'toc'));
      } else if (e.key === 's' || e.key === 'S') {
        setPanel((p) => (p === 'search' ? null : 'search'));
      } else if (e.key === 'a' || e.key === 'A') {
        setPanel((p) => (p === 'settings' ? null : 'settings'));
      } else if (e.key === 'f' || e.key === 'F') {
        window.shoso?.toggleFullscreen?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, parsed, pageScroll, book?.id, currentChapter, pdfPage]);

  if (!book) return null;

  const font = FONT_FAMILIES.find((f) => f.id === readerSettings.fontFamily) || FONT_FAMILIES[0];
  const readerStyle = {
    '--reader-font-size': `${readerSettings.fontSize}px`,
    '--reader-line-height': readerSettings.lineHeight,
    '--reader-font': font.value,
    '--reader-margin': `${readerSettings.margins}px`,
    '--reader-max-width': `${readerSettings.maxWidth}px`,
  };

  const isPdf = parsed?.format === 'PDF';
  const tocItems = isPdf
    ? (parsed?.outline || []).map((o, i) => ({ title: o.title || `עמוד ${i + 1}`, page: o.dest ? null : i + 1 }))
    : (parsed?.toc || []);

  return (
    <div className={`reader reader-theme-${readerSettings.theme}`} style={readerStyle} onMouseMove={pokeUi}>
      {/* Top bar — a single teal strip, exactly like Readera's reader chrome */}
      <div className={`reader-top ${uiVisible ? '' : 'hidden'}`}>
        <button className="icon-btn" onClick={closeBook} title="חזרה (Esc)">
          <IconBack size={21} />
        </button>
        <div className="reader-title">
          <strong>{(parsed?.title || book.title)}</strong>
        </div>
        <div className="reader-actions">
          <button className={`icon-btn ${panel === 'search' ? 'active' : ''}`} onClick={() => setPanel(panel === 'search' ? null : 'search')} title="חיפוש בספר (S)">
            <IconSearch size={20} />
          </button>
          <button className={`icon-btn ${panel === 'toc' ? 'active' : ''}`} onClick={() => setPanel(panel === 'toc' ? null : 'toc')} title="תוכן עניינים (T)">
            <IconToc size={20} />
          </button>
          <button className={`icon-btn ${panel === 'bookmarks' ? 'active' : ''}`} onClick={() => setPanel(panel === 'bookmarks' ? null : 'bookmarks')} title="סימניות">
            <IconBookmark size={20} filled={bookmarks.length > 0} />
          </button>
          <button className={`icon-btn ${panel === 'settings' ? 'active' : ''}`} onClick={() => setPanel(panel === 'settings' ? null : 'settings')} title="הגדרות קריאה (A)">
            <IconFont size={20} />
          </button>
          <button className="icon-btn" onClick={() => window.shoso?.toggleFullscreen?.()} title="מסך מלא (F)">
            <IconFullscreen size={19} />
          </button>
        </div>
      </div>

      <div className="reader-body">
        {/* Side panel */}
        {panel && (
          <aside className="reader-panel">
            <div className="panel-head">
              <h3>
                {panel === 'toc' && 'תוכן עניינים'}
                {panel === 'search' && 'חיפוש בספר'}
                {panel === 'bookmarks' && 'סימניות'}
                {panel === 'settings' && 'הגדרות קריאה'}
              </h3>
              <button className="icon-btn" onClick={() => setPanel(null)}><IconClose size={16} /></button>
            </div>

            {panel === 'toc' && (
              <div className="toc-list">
                {isPdf ? (
                  <>
                    <div className="toc-item">
                      <span>עמודים</span>
                      <span className="dim">{parsed.pageCount} עמודים</span>
                    </div>
                    {Array.from({ length: Math.min(parsed.pageCount, 200) }, (_, i) => (
                      <button key={i} className={`toc-item ${pdfPage === i + 1 ? 'active' : ''}`} onClick={() => setPdfPage(i + 1)}>
                        עמוד {i + 1}
                      </button>
                    ))}
                  </>
                ) : (
                  tocItems.map((item, i) => (
                    <button
                      key={item.id || i}
                      className={`toc-item ${currentChapter === i ? 'active' : ''}`}
                      onClick={() => goChapter(i)}
                    >
                      {item.title}
                    </button>
                  ))
                )}
              </div>
            )}

            {panel === 'search' && (
              <div className="search-panel">
                <div className="search-row">
                  <input
                    autoFocus
                    placeholder="חיפוש טקסט…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                  <button className="btn small primary" onClick={runSearch}>חפש</button>
                </div>
                <div className="search-results">
                  {searchResults.map((r, i) => (
                    <button key={i} className="search-result" onClick={() => { goChapter(r.chapterIndex); setPanel(null); }}>
                      <strong>{r.chapterTitle}</strong>
                      <span>{r.snippet}</span>
                    </button>
                  ))}
                  {searchQuery && searchResults.length === 0 && <p className="dim">לא נמצאו תוצאות</p>}
                </div>
              </div>
            )}

            {panel === 'bookmarks' && (
              <div className="bookmarks-list">
                {bookmarks.length === 0 && <p className="dim">אין סימניות עדיין. לחץ B כדי להוסיף.</p>}
                {bookmarks.map((bm) => (
                  <div key={bm.id} className="bookmark-item">
                    <button
                      className="bookmark-main"
                      onClick={() => {
                        if (isPdf) setPdfPage(bm.page || 1);
                        else goChapter(bm.chapter || 0);
                        setPanel(null);
                      }}
                    >
                      <strong>{bm.label}</strong>
                      <span>{isPdf ? `עמוד ${bm.page}` : `פרק ${(bm.chapter || 0) + 1}`}</span>
                    </button>
                    <button className="icon-btn" onClick={() => removeBookmark(book.id, bm.id)} title="מחק סימנייה">
                      <IconClose size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {panel === 'settings' && (
              <div className="reader-settings">
                <div className="rs-group">מצב צבע</div>
                <div className="rs-modes">
                  {COLOR_MODES.map((m) => {
                    const sw = MODE_SWATCH[m.id] || MODE_SWATCH.dark;
                    return (
                      <button
                        key={m.id}
                        className={`rs-mode ${readerSettings.theme === m.id ? 'active' : ''}`}
                        onClick={() => updateReader({ theme: m.id })}
                        title={m.label}
                      >
                        <span className="rs-swatch" style={{ background: sw.bg }}>
                          <span style={{ width: 13, height: 13, borderRadius: '50%', background: sw.fg, display: 'block' }} />
                        </span>
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="rs-group">כיוון דפדוף</div>
                <div className="seg">
                  <button
                    className={readerSettings.mode === 'scroll' ? 'active' : ''}
                    onClick={() => updateReader({ mode: 'scroll' })}
                  >
                    גלילה
                  </button>
                  <button
                    className={readerSettings.mode === 'paginated' ? 'active' : ''}
                    onClick={() => updateReader({ mode: 'paginated' })}
                  >
                    דפדוף
                  </button>
                </div>

                <div className="rs-group">גופן</div>
                <select
                  className="rs-select"
                  value={readerSettings.fontFamily}
                  onChange={(e) => updateReader({ fontFamily: e.target.value })}
                >
                  {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>

                <div className="rs-group">גודל גופן</div>
                <div className="rs-row">
                  <input
                    type="range"
                    min="12"
                    max="32"
                    value={readerSettings.fontSize}
                    onChange={(e) => updateReader({ fontSize: Number(e.target.value) })}
                  />
                  <div className="rs-stepper">
                    <button onClick={() => updateReader({ fontSize: Math.max(12, readerSettings.fontSize - 1) })}>−</button>
                    <em>{readerSettings.fontSize}</em>
                    <button onClick={() => updateReader({ fontSize: Math.min(32, readerSettings.fontSize + 1) })}>+</button>
                  </div>
                </div>

                <div className="rs-group">ריווח שורות</div>
                <div className="rs-row">
                  <input
                    type="range"
                    min="1.2"
                    max="2.4"
                    step="0.1"
                    value={readerSettings.lineHeight}
                    onChange={(e) => updateReader({ lineHeight: Number(e.target.value) })}
                  />
                  <div className="rs-stepper">
                    <button onClick={() => updateReader({ lineHeight: Math.max(1.2, Number((readerSettings.lineHeight - 0.1).toFixed(1))) })}>−</button>
                    <em>{readerSettings.lineHeight}</em>
                    <button onClick={() => updateReader({ lineHeight: Math.min(2.4, Number((readerSettings.lineHeight + 0.1).toFixed(1))) })}>+</button>
                  </div>
                </div>

                <div className="rs-group">יישור טקסט</div>
                <div className="seg">
                  <button className={!readerSettings.justify ? 'active' : ''} onClick={() => updateReader({ justify: false })}>טבעי</button>
                  <button className={readerSettings.justify ? 'active' : ''} onClick={() => updateReader({ justify: true })}>דו-צדדי</button>
                </div>

                <div className="rs-group">שולי עמוד</div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="4"
                  value={readerSettings.margins}
                  onChange={(e) => updateReader({ margins: Number(e.target.value) })}
                />

                <div className="rs-group">רוחב טור</div>
                <input
                  type="range"
                  min="480"
                  max="1100"
                  step="20"
                  value={readerSettings.maxWidth}
                  onChange={(e) => updateReader({ maxWidth: Number(e.target.value) })}
                />

                <div className="rs-divider" />

                <button className="rs-link" onClick={() => setPanel('toc')}>
                  <IconToc size={18} /> תוכן העניינים
                  <IconChevron size={16} style={{ marginInlineStart: 'auto', opacity: 0.6 }} />
                </button>
                <button className="rs-link" onClick={() => setPanel('bookmarks')}>
                  <IconBookmark size={18} /> סימניות, ציטוטים והערות
                  <IconChevron size={16} style={{ marginInlineStart: 'auto', opacity: 0.6 }} />
                </button>

                <div className="rs-group">הקראה (TTS)</div>
                <div className="seg">
                  {TTS_RATES.map((r) => (
                    <button key={r} className={tts.rate === r ? 'active' : ''} onClick={() => setTts((t) => ({ ...t, rate: r }))}>
                      {r}x
                    </button>
                  ))}
                </div>

                <div className="rs-group">כללי</div>
                <label className="rs-row" style={{ cursor: 'pointer' }}>
                  <span>מקפים אוטומטיים</span>
                  <input
                    type="checkbox"
                    checked={readerSettings.hyphenation}
                    onChange={(e) => updateReader({ hyphenation: e.target.checked })}
                  />
                </label>
              </div>
            )}
          </aside>
        )}

        {/* Content */}
        <div className="reader-content">
          {loading && (
            <div className="reader-loading">
              <div className="spinner" />
              <p>טוען את הספר…</p>
            </div>
          )}
          {error && (
            <div className="reader-error">
              <h2>לא ניתן לפתוח את הספר</h2>
              <p>{error}</p>
              <button className="btn primary" onClick={closeBook}>חזרה לספרייה</button>
            </div>
          )}
          {!loading && !error && isPdf && (
            <div className="pdf-reader">
              <div className="pdf-toolbar">
                <button className="icon-btn" onClick={() => setPdfPage((p) => Math.max(1, p - 1))}>‹</button>
                <span>עמוד {pdfPage} / {parsed.pageCount}</span>
                <button className="icon-btn" onClick={() => setPdfPage((p) => Math.min(parsed.pageCount, p + 1))}>›</button>
                <span className="sep" />
                <button className="icon-btn" onClick={() => setPdfZoom((z) => Math.max(0.5, z - 0.25))}><IconZoomOut size={17} /></button>
                <span>{Math.round(pdfZoom * 100)}%</span>
                <button className="icon-btn" onClick={() => setPdfZoom((z) => Math.min(4, z + 0.25))}><IconZoomIn size={17} /></button>
                <input
                  type="range"
                  min="1"
                  max={parsed.pageCount}
                  value={pdfPage}
                  onChange={(e) => setPdfPage(Number(e.target.value))}
                  className="pdf-slider"
                />
              </div>
              <div className="pdf-canvas-wrap">
                <canvas ref={pdfCanvasRef} className="pdf-canvas" />
              </div>
            </div>
          )}
          {!loading && !error && !isPdf && parsed && (
            <div
              ref={scrollRef}
              className={`book-scroll ${readerSettings.justify ? 'justify' : ''} ${readerSettings.hyphenation ? 'hyphen' : ''} ${readerSettings.mode === 'paginated' ? 'paginated' : ''}`}
              dir={parsed.direction || 'rtl'}
              onScroll={onScroll}
              onClick={pokeUi}
            >
              <div className="book-page">
                {parsed.chapters.map((ch, i) => (
                  <section
                    key={ch.id || i}
                    ref={(el) => { chapterRefs.current[i] = el; }}
                    className="book-chapter"
                    data-chapter={i}
                  >
                    <div dangerouslySetInnerHTML={{ __html: ch.html }} />
                  </section>
                ))}
                <div className="book-end">
                  <p>— סוף הספר —</p>
                  <p className="dim">{parsed.chapters.length} פרקים · {percent}% נקראו</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar — "2 מתוך 3" plus the progress line, like Readera */}
      <div className={`reader-bottom ${uiVisible ? '' : 'hidden'}`}>
        <span className="page-label">
          {isPdf
            ? `${pdfPage} מתוך ${parsed?.pageCount || '?'}`
            : `${pageInfo.page} מתוך ${pageInfo.pages}`}
        </span>
        <div className="reader-progress">
          <div className="progress-track">
            <span style={{ width: `${isPdf ? percent : Math.max(2, percent)}%` }} />
          </div>
          <span className="page-label dim" style={{ color: 'rgba(255,255,255,.8)' }}>{percent}%</span>
        </div>
        {!isPdf && (
          <button
            className="icon-btn"
            onClick={() => (tts.playing ? stopTts() : speakChapter(currentChapter))}
            title="הקראת טקסט (TTS)"
          >
            {tts.playing ? <IconStop size={18} /> : <IconTts size={18} />}
          </button>
        )}
        <button
          className="icon-btn"
          onClick={() => addBookmark(book.id, { chapter: currentChapter, scroll: scrollRef.current?.scrollTop || 0, page: pdfPage })}
          title="הוסף סימנייה (B)"
        >
          <IconBars size={18} />
        </button>
      </div>
    </div>
  );
}
