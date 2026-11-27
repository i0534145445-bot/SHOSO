/**
 * How long does the library actually take with a big one?
 *
 * Opens the built app with ?bench=1, injects 500 / 5 000 / 10 000 books into
 * the real store, and times the first paint and a scroll — in a real Chromium,
 * not in jsdom. Writes screenshots/bench.txt.
 */
import { chromium } from 'playwright';
import { appendFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.SCREENSHOT_URL || 'http://localhost:4173';
const OUT = 'screenshots/bench.txt';
writeFileSync(OUT, `library benchmark ${new Date().toISOString()}\n`, 'utf8');
const line = (text) => {
  appendFileSync(OUT, `${text}\n`, 'utf8');
  console.log(text);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/?bench=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.shosoDebug), null, { timeout: 30000 });

// the demo library is small – let the app settle, then replace it wholesale
await page.waitForTimeout(800);

for (const size of [500, 5000, 10000]) {
  const result = await page.evaluate(async (n) => {
    const books = Array.from({ length: n }, (_, i) => ({
      id: `bench-${i}`,
      path: `/books/bench-${i}.epub`,
      dir: '/books',
      fileName: `bench-${i}.epub`,
      title: `ספר בדיקה ${String(i).padStart(5, '0')}`,
      author: `מחבר ${i % 250}`,
      genres: [`ז׳אנר ${i % 12}`],
      language: 'he',
      format: i % 5 === 0 ? 'PDF' : 'EPUB',
      ext: i % 5 === 0 ? '.pdf' : '.epub',
      size: 400000 + i,
      mtime: 1700000000000 + i,
      cover: null,
      pageCount: 0,
      chapters: 10,
      wordCount: 50000,
      addedAt: 1700000000000 + i,
    }));

    const raf = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const scroller = document.querySelector('.view-scroll');
    if (scroller) scroller.scrollTop = 0;

    const started = performance.now();
    window.shosoDebug.setState({ books, view: 'books', query: '' });
    await raf();
    const painted = performance.now() - started;

    const rows = document.querySelectorAll('.book-row').length;
    const nodes = document.querySelectorAll('.view-scroll *').length;
    const spacers = [...document.querySelectorAll('.vgrid > div[aria-hidden="true"]')]
      .map((el) => Math.round(el.getBoundingClientRect().height));
    const totalHeight = scroller ? Math.round(scroller.scrollHeight) : 0;

    scroller.scrollTop = scroller.scrollHeight / 2;
    const scrollStart = performance.now();
    await raf();
    const scrollCost = performance.now() - scrollStart;

    // typing in the search box: filtering + sorting the whole library
    const searchStart = performance.now();
    window.shosoDebug.setState({ query: 'בדיקה 00' });
    await raf();
    const searchCost = performance.now() - searchStart;
    const hits = document.querySelectorAll('.book-row').length;
    window.shosoDebug.setState({ query: '' });
    await raf();

    return {
      painted: Math.round(painted),
      rows,
      nodes,
      spacers,
      hits,
      totalHeight,
      scrollCost: Math.round(scrollCost),
      searchCost: Math.round(searchCost),
    };
  }, size);

  line(`${String(size).padStart(6)} books · first paint ${result.painted} ms · `
    + `rows in DOM ${result.rows} (all nodes ${result.nodes}) · `
    + `spacers ${result.spacers.join(' / ')}px · scrollbar ${result.totalHeight}px · `
    + `scroll ${result.scrollCost} ms · search ${result.searchCost} ms (${result.hits} rows drawn)`);

  if (size === 10000) {
    await page.evaluate(() => {
      const scroller = document.querySelector('.view-scroll');
      if (scroller) scroller.scrollTop = 0;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/19-library-10k-top.png' });
    await page.evaluate(() => {
      const scroller = document.querySelector('.view-scroll');
      if (scroller) scroller.scrollTop = scroller.scrollHeight * 0.62;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/20-library-10k-mid.png' });
  }
}

await browser.close();
