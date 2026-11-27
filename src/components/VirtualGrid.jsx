import React, {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react';

/**
 * A windowed grid.
 *
 * A photo app shows "everything at once" because it only draws the tiles that
 * are on screen: the scrollbar knows the full height, but the DOM holds one
 * screenful. That is exactly what this does for the library – ten thousand
 * books cost the same as sixty, while scrolling feels like one long list.
 *
 * Geometry comes from the real element (clientWidth / scrollTop), the row
 * height is measured from the first painted card, and the rest of the list is
 * two spacer boxes – so the scrollbar, the scroll position and the keyboard all
 * behave as if every card existed.
 */

const OVERSCAN_ROWS = 4;
/** No layout to measure (tests, or a first frame): draw a screenful anyway. */
const FALLBACK_VIEWPORT = 700;

export default function VirtualGrid({
  items,
  renderItem,
  keyOf,
  className = '',
  singleColumn = false,
  minColumnWidth = 300,
  gapX = 8,
  gapY = 8,
  paddingX = 8,
  estimateRowHeight = 142,
  itemSelector = '',
  scrollerSelector = '.view-scroll',
}) {
  const wrapRef = useRef(null);
  const [geom, setGeom] = useState({ width: 0, top: 0, viewHeight: 0, offset: 0 });
  const [rowHeight, setRowHeight] = useState(estimateRowHeight);
  const frame = useRef(0);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const scroller = wrap.closest(scrollerSelector);
    const width = wrap.clientWidth || 0;
    const viewHeight = scroller ? scroller.clientHeight : window.innerHeight;
    const top = scroller ? scroller.scrollTop : window.scrollY;
    let offset = 0;
    if (scroller) {
      offset = wrap.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    }
    setGeom((prev) => (
      prev.width === width && prev.top === top && prev.viewHeight === viewHeight && prev.offset === offset
        ? prev
        : { width, top, viewHeight, offset }
    ));
  }, [scrollerSelector]);

  useEffect(() => {
    measure();
    const wrap = wrapRef.current;
    const scroller = wrap && wrap.closest(scrollerSelector);
    const bump = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        measure();
      });
    };
    const target = scroller || window;
    target.addEventListener('scroll', bump, { passive: true });
    window.addEventListener('resize', bump);
    let observer = null;
    if (typeof ResizeObserver !== 'undefined' && wrap) {
      observer = new ResizeObserver(bump);
      observer.observe(wrap);
    }
    return () => {
      target.removeEventListener('scroll', bump);
      window.removeEventListener('resize', bump);
      if (observer) observer.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [measure, scrollerSelector]);

  // The first card tells us the true row height (a cover is 2:3, text wraps).
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const first = wrap.querySelector(itemSelector || '.vgrid-item');
    if (!first) return;
    const height = first.getBoundingClientRect().height;
    if (height > 20) {
      const next = singleColumn ? height : height + gapY;
      setRowHeight((prev) => (Math.abs(prev - next) > 2 ? next : prev));
    }
  });

  const count = items.length;
  const columns = singleColumn || geom.width <= 0
    ? 1
    : Math.max(1, Math.floor((geom.width - paddingX * 2 + gapX) / (minColumnWidth + gapX)));
  const rows = Math.max(0, Math.ceil(count / columns));
  const rowH = Math.max(24, rowHeight || estimateRowHeight);
  const viewHeight = geom.viewHeight || FALLBACK_VIEWPORT;
  const relativeTop = Math.max(0, geom.top - geom.offset);

  const firstRow = Math.max(0, Math.floor(relativeTop / rowH) - OVERSCAN_ROWS);
  const lastRow = Math.min(rows, Math.ceil((relativeTop + viewHeight) / rowH) + OVERSCAN_ROWS);
  const start = firstRow * columns;
  const end = Math.min(count, lastRow * columns);

  const label = singleColumn ? 'flex' : 'grid';
  return (
    <div className={`vgrid${singleColumn ? ' single' : ''} ${className}`.trim()} ref={wrapRef}>
      <div style={{ height: `${firstRow * rowH}px` }} aria-hidden="true" />
      <div
        className={`vgrid-window${singleColumn ? ' single' : ''}`}
        style={label === 'grid' ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {items.slice(start, end).map((item, i) => renderItem(item, start + i, keyOf ? keyOf(item) : start + i))}
      </div>
      <div style={{ height: `${Math.max(0, rows - lastRow) * rowH}px` }} aria-hidden="true" />
    </div>
  );
}
