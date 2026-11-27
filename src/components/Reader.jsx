import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useStore, getState, bookById, closeBook, saveProgress, markFinished,
  addBookmark, removeBookmark, updateReader, addReadingTime, toast, setState,
  addHighlight, removeHighlight,
} from '../lib/store.js';
import { readBookBuffer } from '../lib/platform.js';
import { parseBookBuffer, searchChapters, renderPdfPage, loadPdf, DETECTED_ONLY_EXT, extOf } from '../lib/parsers.js';
import { FONT_FAMILIES, COLOR_MODES } from '../lib/store.js';
import {
  paintHighlights, stripNiqqudHtml, normalizeSpace, stripNiqqud, shortQuote, HIGHLIGHT_COLORS,
} from '../lib/annotate.js';
import {
  IconBack, IconToc, IconSearch, IconBookmark, IconTts, IconFullscreen,
  IconClose, IconZoomIn, IconZoomOut, IconStop,
  IconMore, IconSettings, IconBookmarkSolid, IconPause, IconPlay, IconColorLens,
  IconArrowDropDown, IconAddCircleOutline, IconRemoveCircleOutline,
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
  const highlights = useStore((s) => (currentBookId ? s.highlights[currentBookId] : null) || []);
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [ttsText, setTtsText] = useState('');
  const [selection, setSelection] = useState(null); // { quote, chapter, top, left }

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
  const scrollFrame = useRef(0);
  const onScroll = useCallback(() => {
    // One measurement per painted frame: reading scrollTop + every chapter's
    // offsetTop on each native scroll event forced a layout per event.
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      measureScroll();
    });
  }, [parsed, book?.id]);

  const measureScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !parsed || parsed.format === 'PDF') return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0;
    setPercent((prev) => (prev === pct ? prev : pct));
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
    // keep the chrome on screen while a panel is open
    if (!panel) uiTimer.current = setTimeout(() => setUiVisible(false), 5000);
  }, [panel]);

  useEffect(() => {
    pokeUi();
    return () => clearTimeout(uiTimer.current);
  }, [pokeUi, panel]);

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

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

  /* ---------- highlights ---------- */
  const chapterOf = useCallback((node) => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    const section = el && el.closest ? el.closest('.book-chapter') : null;
    return section ? Number(section.dataset.chapter) || 0 : 0;
  }, []);

  const captureSelection = useCallback(() => {
    const sel = window.getSelection ? window.getSelection() : null;
    const root = scrollRef.current;
    if (!sel || sel.isCollapsed || !sel.rangeCount || !root || !root.contains(sel.anchorNode)) {
      setSelection(null);
      return;
    }
    const quote = normalizeSpace(sel.toString());
    if (quote.length < 2) {
      setSelection(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({
      quote,
      chapter: chapterOf(sel.anchorNode),
      top: Math.max(60, rect.top - 6),
      left: Math.min(window.innerWidth - 90, Math.max(90, rect.left + rect.width / 2)),
    });
  }, [chapterOf]);

  const highlightSelection = useCallback((color) => {
    if (!selection || !book?.id) return;
    addHighlight(book.id, { chapter: selection.chapter, quote: selection.quote, color });
    window.getSelection?.().removeAllRanges();
    setSelection(null);
  }, [selection, book?.id]);

  const copySelection = useCallback(() => {
    if (!selection) return;
    navigator.clipboard?.writeText(selection.quote).then(
      () => toast('הקטע הועתק', 'success'),
      () => toast('לא ניתן להעתיק', 'error'),
    );
    setSelection(null);
  }, [selection]);

  const onContentClick = useCallback((e) => {
    // A click also ends a text drag; a live selection means the bar should stay.
    const live = window.getSelection ? window.getSelection() : null;
    if (live && !live.isCollapsed) return;
    setSelection(null);
    const mark = e.target.closest ? e.target.closest('mark.shoso-hl') : null;
    if (!mark || !book?.id) return;
    const hit = highlights.find((h) => stripNiqqud(normalizeSpace(h.quote)) === stripNiqqud(normalizeSpace(mark.textContent)));
    if (!hit) return;
    removeHighlight(book.id, hit.id);
    toast('ההדגשה הוסרה', 'info');
  }, [highlights, book?.id]);

  // Repaint after every render of the text: React rewrites the chapters on a
  // font or niqqud change, which throws the old <mark>s away.
  useEffect(() => {
    if (!parsed || parsed.format === 'PDF') return;
    chapterRefs.current.forEach((section, i) => {
      if (!section) return;
      paintHighlights(section, highlights.filter((h) => Number(h.chapter || 0) === i));
    });
  }, [highlights, parsed, readerSettings.niqqud, readerSettings.fontSize, readerSettings.fontFamily]);

  /* ---------- automatic reading ---------- */
  const toggleAutoScroll = useCallback(() => {
    if (readerSettings.autoScroll) {
      updateReader({ autoScroll: false });
      return;
    }
    if (readerSettings.mode !== 'scroll') updateReader({ mode: 'scroll' });
    updateReader({ autoScroll: true });
    toast('קריאה אוטומטית פועלת — גלגלת העכבר עוצרת אותה', 'info');
  }, [readerSettings.autoScroll, readerSettings.mode]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !readerSettings.autoScroll) return undefined;
    let raf = 0;
    const speed = Math.max(0.4, Number(readerSettings.autoScrollSpeed || 20) / 10);
    const step = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (el.scrollTop >= max - 1) {
        updateReader({ autoScroll: false });
        toast('הגעת לסוף הספר', 'success');
        return;
      }
      el.scrollTop += speed;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const stop = () => updateReader({ autoScroll: false });
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('touchstart', stop, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchstart', stop);
    };
  }, [readerSettings.autoScroll, readerSettings.autoScrollSpeed, parsed]);

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
      } else if (e.key === 'p' || e.key === 'P') {
        toggleAutoScroll();
      } else if (e.key === 'a' || e.key === 'A') {
        setPanel((p) => (p === 'settings' ? null : 'settings'));
      } else if (e.key === 'f' || e.key === 'F') {
        window.shoso?.toggleFullscreen?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, parsed, pageScroll, book?.id, currentChapter, pdfPage, toggleAutoScroll]);

  // Memoised: the niqqud pass rewrites every chapter's HTML, so it must not run
  // on each scroll tick.
  const renderedChapters = useMemo(() => {
    const list = parsed?.chapters || [];
    if (readerSettings.niqqud !== false) return list;
    return list.map((ch) => ({ ...ch, html: stripNiqqudHtml(ch.html) }));
  }, [parsed, readerSettings.niqqud]);

  if (!book) return null;

  const font = FONT_FAMILIES.find((f) => f.id === readerSettings.fontFamily) || FONT_FAMILIES[0];
  const readerStyle = {
    '--reader-font-size': `${readerSettings.fontSize}px`,
    '--reader-line-height': readerSettings.lineHeight,
    '--reader-font-weight': readerSettings.fontWeight || 400,
    '--reader-font': font.value,
    '--reader-margin': `${readerSettings.margins}px`,
    '--reader-max-width': `${readerSettings.maxWidth}px`,
  };

  const isPdf = parsed?.format === 'PDF';
  const tocItems = isPdf
    ? (parsed?.outline || []).map((o, i) => ({ title: o.title || `עמוד ${i + 1}`, page: o.dest ? null : i + 1 }))
    : (parsed?.toc || []);

  return (
    <div className={`reader reader-theme-${readerSettings.theme}${readerSettings.autoScroll ? ' auto-reading' : ''}`} style={readerStyle} onMouseMove={pokeUi}>
      {selection && (
        <div className="sel-bar" style={{ top: selection.top, left: selection.left }} onMouseDown={(e) => e.preventDefault()}>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              className={`sel-dot dot-${c.id}`}
              title={`הדגש ${c.label}`}
              onClick={() => highlightSelection(c.id)}
            />
          ))}
          <span className="sel-sep" />
          <button className="sel-act" onClick={copySelection} title="העתק את הקטע">העתק</button>
          <button className="sel-act" onClick={() => { window.getSelection?.().removeAllRanges(); setSelection(null); }} title="סגור">
            <IconClose size={15} />
          </button>
        </div>
      )}
      {/* Top bar — ReadEra's two-row header: actions above, book title below */}
      <div className={`reader-top ${uiVisible ? '' : 'hidden'}`}>
        <div className="reader-bar-row">
          <button className="icon-btn" onClick={closeBook} title="חזרה (Esc)">
            <IconBack size={22} className="icon-rtl-flip" />
          </button>
          <div className="reader-bar-grow" />
          <button
            className={`icon-btn ${panel === 'search' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'search' ? null : 'search')}
            title="חיפוש בספר (S)"
          >
            <IconSearch size={21} />
          </button>
          <button
            className={`icon-btn ${panel === 'toc' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'toc' ? null : 'toc')}
            title="תוכן עניינים (T)"
          >
            <IconToc size={21} />
          </button>
          <button
            className={`icon-btn ${panel === 'highlights' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'highlights' ? null : 'highlights')}
            title="הדגשות"
          >
            <IconColorLens size={21} />
          </button>
          <button
            className={`icon-btn ${panel === 'settings' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
            title="הגדרות קריאה (A)"
          >
            <IconSettings size={21} />
          </button>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setMoreOpen((v) => !v)} title="עוד">
              <IconMore size={21} />
            </button>
            {moreOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMoreOpen(false)} />
                <div className="row-menu" style={{ top: 'calc(100% + 2px)' }}>
                  <button onClick={() => { setMoreOpen(false); setPanel('bookmarks'); }}>
                    <IconBookmark size={18} /> סימניות ({bookmarks.length})
                  </button>
                  <button onClick={() => { setMoreOpen(false); setPanel('highlights'); }}>
                    <IconColorLens size={18} /> הדגשות ({highlights.length})
                  </button>
                  <button
                    onClick={() => {
                      setMoreOpen(false);
                      addBookmark(book.id, { chapter: currentChapter, scroll: scrollRef.current?.scrollTop || 0, page: pdfPage });
                    }}
                  >
                    <IconBookmarkSolid size={18} /> הוסף סימנייה
                  </button>
                  {!isPdf && (
                    <button onClick={() => { setMoreOpen(false); tts.playing ? stopTts() : speakChapter(currentChapter); }}>
                      <IconTts size={18} /> {tts.playing ? 'עצור הקראה' : 'הקרא בקול'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMoreOpen(false);
                      // Desktop window chrome when the Electron bridge is there,
                      // the browser's own fullscreen when it isn't – never a
                      // button that does nothing.
                      if (window.shoso?.toggleFullscreen) {
                        window.shoso.toggleFullscreen();
                        return;
                      }
                      if (document.fullscreenElement) document.exitFullscreen?.();
                      else document.documentElement.requestFullscreen?.();
                    }}
                  >
                    <IconFullscreen size={18} /> מסך מלא
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="reader-bar-title" title={parsed?.title || book.title}>
          {parsed?.title || book.title}
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
                {panel === 'highlights' && 'הדגשות'}
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

            {panel === 'highlights' && (
              <div className="highlights-list">
                {highlights.length === 0 && (
                  <p className="dim">אין הדגשות עדיין. סמן קטע בטקסט ולחץ על צבע.</p>
                )}
                {highlights.map((h) => (
                  <div key={h.id} className="highlight-item">
                    <button
                      className="highlight-main"
                      onClick={() => { goChapter(h.chapter || 0); setPanel(null); }}
                    >
                      <i className={`hl-dot dot-${h.color || 'yellow'}`} />
                      <span>{shortQuote(h.quote)}</span>
                      <em>פרק {(h.chapter || 0) + 1}</em>
                    </button>
                    <button className="icon-btn" onClick={() => removeHighlight(book.id, h.id)} title="מחק הדגשה">
                      <IconClose size={14} />
                    </button>
                  </div>
                ))}
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
                <div className="rs-head">
                  <span className="rs-head-title">הגדרות קריאה</span>
                  <span className="rs-head-formats">EPUB · FB2 · MOBI · DOC · DOCX · PDF · TXT</span>
                </div>

                <div className="rs-block">
                  <div className="rs-cap">כיוון דפדוף</div>
                  <div className="rs-value-row">
                    <span>{readerSettings.mode === 'scroll' ? 'אנכי' : 'אופקי'}</span>
                    <IconArrowDropDown size={22} />
                    <select value={readerSettings.mode} onChange={(e) => updateReader({ mode: e.target.value })}>
                      <option value="paginated">אופקי</option>
                      <option value="scroll">אנכי</option>
                    </select>
                  </div>
                </div>

                <div className="rs-block">
                  <div className="rs-cap">מצב צבע</div>
                  <div className="rs-value-row">
                    <span>{COLOR_MODES.find((m) => m.id === readerSettings.theme)?.label || 'רגיל'}</span>
                    <IconArrowDropDown size={22} />
                    <select value={readerSettings.theme} onChange={(e) => updateReader({ theme: e.target.value })}>
                      {COLOR_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="rs-block">
                  <div className="rs-cap">גופן</div>
                  <div className="rs-value-row">
                    <span>{FONT_FAMILIES.find((f) => f.id === readerSettings.fontFamily)?.label}</span>
                    <IconArrowDropDown size={22} />
                    <select value={readerSettings.fontFamily} onChange={(e) => updateReader({ fontFamily: e.target.value })}>
                      {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="rs-block">
                  <div className="rs-cap">גודל גופן</div>
                  <div className="rs-step">
                    <button onClick={() => updateReader({ fontSize: Math.max(12, readerSettings.fontSize - 1) })} title="הקטן">
                      <IconRemoveCircleOutline size={24} />
                    </button>
                    <em>{readerSettings.fontSize}</em>
                    <button onClick={() => updateReader({ fontSize: Math.min(32, readerSettings.fontSize + 1) })} title="הגדל">
                      <IconAddCircleOutline size={24} />
                    </button>
                  </div>
                </div>

                <div className="rs-block">
                  <div className="rs-cap">עובי גופן</div>
                  <input
                    type="range"
                    min="300"
                    max="700"
                    step="100"
                    value={readerSettings.fontWeight || 400}
                    style={{ '--pct': `${(((readerSettings.fontWeight || 400) - 300) / 400) * 100}%` }}
                    onChange={(e) => updateReader({ fontWeight: Number(e.target.value) })}
                  />
                </div>

                <div className="rs-block">
                  <div className="rs-cap">ריווח שורות</div>
                  <div className="rs-step">
                    <button
                      onClick={() => updateReader({ lineHeight: Math.max(1.2, Number((readerSettings.lineHeight - 0.1).toFixed(1))) })}
                      title="הקטן"
                    >
                      <IconRemoveCircleOutline size={24} />
                    </button>
                    <em>{Math.round((readerSettings.lineHeight / 1.7) * 100)}%</em>
                    <button
                      onClick={() => updateReader({ lineHeight: Math.min(2.4, Number((readerSettings.lineHeight + 0.1).toFixed(1))) })}
                      title="הגדל"
                    >
                      <IconAddCircleOutline size={24} />
                    </button>
                  </div>
                </div>

                <div className="rs-block">
                  <div className="rs-cap">יישור טקסט</div>
                  <div className="rs-value-row">
                    <span>{readerSettings.justify ? 'מיושר לשני הצדדים' : 'טבעי'}</span>
                    <IconArrowDropDown size={22} />
                    <select
                      value={readerSettings.justify ? 'justify' : 'natural'}
                      onChange={(e) => updateReader({ justify: e.target.value === 'justify' })}
                    >
                      <option value="justify">מיושר לשני הצדדים</option>
                      <option value="natural">טבעי</option>
                    </select>
                  </div>
                </div>

                <div className="rs-block">
                  <div className="rs-cap">שולי עמוד</div>
                  <input
                    type="range"
                    min="0"
                    max="120"
                    step="4"
                    value={readerSettings.margins}
                    style={{ '--pct': `${(readerSettings.margins / 120) * 100}%` }}
                    onChange={(e) => updateReader({ margins: Number(e.target.value) })}
                  />
                </div>

                <div className="rs-block switch">
                  <span>מקפים אוטומטיים</span>
                  <label className="rs-switch">
                    <input
                      type="checkbox"
                      checked={readerSettings.hyphenation}
                      onChange={(e) => updateReader({ hyphenation: e.target.checked })}
                    />
                    <i />
                  </label>
                </div>

                <div className="rs-block switch">
                  <span>ניקוד</span>
                  <label className="rs-switch">
                    <input
                      type="checkbox"
                      checked={readerSettings.niqqud}
                      onChange={(e) => updateReader({ niqqud: e.target.checked })}
                    />
                    <i />
                  </label>
                </div>

                <div className="rs-block switch">
                  <span>קריאה אוטומטית</span>
                  <label className="rs-switch">
                    <input
                      type="checkbox"
                      checked={Boolean(readerSettings.autoScroll)}
                      onChange={toggleAutoScroll}
                    />
                    <i />
                  </label>
                </div>

                {readerSettings.autoScroll && (
                  <div className="rs-block">
                    <div className="rs-cap">מהירות גלילה</div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={readerSettings.autoScrollSpeed ?? 20}
                      style={{ '--pct': `${(((readerSettings.autoScrollSpeed ?? 20) - 5) / 55) * 100}%` }}
                      onChange={(e) => updateReader({ autoScrollSpeed: Number(e.target.value) })}
                    />
                  </div>
                )}

                <div className="rs-block switch">
                  <span>הקראה בקול</span>
                  <label className="rs-switch">
                    <input
                      type="checkbox"
                      checked={Boolean(tts.playing)}
                      onChange={() => (tts.playing ? stopTts() : speakChapter(currentChapter))}
                    />
                    <i />
                  </label>
                </div>

                <button className="rs-general" onClick={() => { closeBook(); setState({ view: 'settings' }); }}>
                  הגדרות כלליות
                </button>
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
              onMouseUp={captureSelection}
              onTouchEnd={captureSelection}
              onClick={(e) => { pokeUi(e); onContentClick(e); }}
            >
              <div className="book-page">
                {renderedChapters.map((ch, i) => (
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
        <button
          className={`icon-btn ${readerSettings.autoScroll ? 'active' : ''}`}
          onClick={toggleAutoScroll}
          title="קריאה אוטומטית (P)"
        >
          {readerSettings.autoScroll ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
        <button
          className="icon-btn"
          onClick={() => addBookmark(book.id, { chapter: currentChapter, scroll: scrollRef.current?.scrollTop || 0, page: pdfPage })}
          title="הוסף סימנייה (B)"
        >
          <IconBookmark size={20} filled={bookmarks.length > 0} />
        </button>
        <button
          className={`icon-btn ${panel === 'toc' ? 'active' : ''}`}
          onClick={() => setPanel(panel === 'toc' ? null : 'toc')}
          title="תוכן עניינים (T)"
        >
          <IconToc size={20} />
        </button>
      </div>
    </div>
  );
}
