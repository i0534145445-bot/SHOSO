/**
 * Real screenshots of SHOSO Books (browser mode = same UI as the EXE).
 * Requires the built app served at http://localhost:4173 (set SCREENSHOT_URL to override).
 *
 * Every PNG below is a genuine capture of the running app — no mockups.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.SCREENSHOT_URL || 'http://localhost:4173';
const TRACE = `${OUT}/run.txt`;
writeFileSync(TRACE, `start ${new Date().toISOString()}\n`, 'utf8');
const trace = (msg) => {
  try { appendFileSync(TRACE, `${msg}\n`, 'utf8'); } catch { /* ignore */ }
  console.log(msg);
};
process.on('uncaughtException', (err) => { trace(`uncaught: ${err && err.stack}`); process.exit(1); });
process.on('unhandledRejection', (err) => { trace(`unhandled: ${err && err.stack}`); process.exit(1); });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const shot = async (name) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  trace(`saved ${name}`);
};

/** Run one capture step; a failure is logged and never aborts the whole run. */
const step = async (label, fn) => {
  try {
    await fn();
    trace(`ok ${label}`);
  } catch (err) {
    trace(`FAIL ${label} — ${err.message.split('\n')[0]}`);
    const state = await page.evaluate(() => ({
      view: document.querySelector('.topbar-title')?.textContent,
      rows: document.querySelectorAll('.book-row').length,
      drawer: Boolean(document.querySelector('.drawer')),
      text: document.body.innerText.slice(0, 240).replace(/\s+/g, ' '),
    })).catch(() => ({}));
    writeFileSync(`${OUT}/99-error.txt`, `step: ${label}\n${err.message}\n${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await page.screenshot({ path: `${OUT}/99-failure.png` }).catch(() => {});
  }
};

/** The reader hides its chrome after a few idle seconds – wiggle the pointer. */
const showUi = async () => {
  await page.mouse.move(720, 420);
  await page.waitForTimeout(250);
};

/** The library is in selection mode? Escape first so the normal bar is back. */
const ensureNoSelection = async () => {
  if (await page.locator('.selection-bar').count()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
};

const clickTitle = async (title) => {
  await ensureNoSelection();
  const el = page.locator(`[title="${title}"]`).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.click();
};

const clickDrawerItem = async (label) => {
  const el = page.locator('.drawer .nav-item').filter({ hasText: label }).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.click();
};

const clickText = async (text) => {
  const el = page.getByText(text, { exact: true }).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.click();
};

try {
  trace('goto');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  trace('loaded');
  // demo books are seeded automatically in browser mode
  await page.waitForSelector('.book-row', { timeout: 45000 });
  trace('rows ready');

  await step('drawer', async () => {
    await clickTitle('תפריט');
    await page.waitForSelector('.drawer', { timeout: 6000 });
    await shot('02-drawer');
  });

  await step('books list', async () => {
    await clickDrawerItem('ספרים ומסמכים');
    await page.waitForSelector('.book-list', { timeout: 6000 });
    // use the real row actions so the gold "active" chips are genuine state
    await page.locator('.book-row').nth(1).locator('.row-actions .icon-btn').nth(0).click();
    await page.locator('.book-row').nth(2).locator('.row-actions .icon-btn').nth(1).click();
    await page.locator('.book-row').nth(3).locator('.row-actions .icon-btn').nth(2).click();
    await page.waitForTimeout(400);
    await shot('03-books-list');
  });

  await step('books tiles', async () => {
    // ReadEra's four library views are all reachable from the overflow menu
    await clickTitle('עוד');
    await page.locator('.topbar-menu-pop button').filter({ hasText: 'תמונות ממוזערות' }).click();
    await page.waitForSelector('.book-grid.thumbs .book-tile', { timeout: 6000 });
    await shot('04-books-thumbs');

    await clickTitle('עוד');
    await page.locator('.topbar-menu-pop button').filter({ hasText: 'תצוגה תמציתית' }).click();
    await page.waitForSelector('.brief-row', { timeout: 6000 });
    await shot('04b-books-brief');

    await clickTitle('עוד');
    await page.locator('.topbar-menu-pop button').filter({ hasText: 'כריכות' }).click();
    await page.waitForSelector('.book-grid.tiles .book-tile', { timeout: 6000 });
    await shot('04c-books-grid');

    await clickTitle('עוד');
    await page.locator('.topbar-menu-pop button').filter({ hasText: 'תצוגה מלאה' }).click();
    await page.waitForSelector('.book-row', { timeout: 6000 });
  });

  await step('reader', async () => {
    // the EPUB demo book is the long one: a tap opens ReadEra's description
    // screen, and only the explicit read button opens the book
    await ensureNoSelection();
    await page.locator('.book-row h3').filter({ hasText: 'הספר הישן' }).first().click();
    await page.waitForSelector('.book-detail', { timeout: 10000 });
    await page.waitForSelector('.bd-read', { timeout: 6000 });
    await page.locator('.bd-read').click();
    await page.waitForSelector('.book-scroll', { timeout: 45000 });
    await page.mouse.move(700, 450);
    await page.waitForTimeout(700);
    // real reading progress so "Reading Now" is meaningful later
    await page.mouse.wheel(0, 620);
    await page.waitForTimeout(1400);
    await page.mouse.move(700, 450);
    await shot('05-reader-night');
  });

  await step('reader settings', async () => {
    await showUi();
    await clickTitle('הגדרות קריאה (A)');
    await page.waitForSelector('.reader-settings', { timeout: 6000 });
    await shot('06-reader-settings');
    // the sheet scrolls – the niqqud / automatic-reading rows are below
    await page.locator('.reader-settings').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await shot('06b-reader-settings-bottom');
    await page.locator('.reader-settings').evaluate((el) => { el.scrollTop = 0; });
  });

  await step('sepia mode', async () => {
    await page
      .locator('.rs-block', { hasText: 'מצב צבע' })
      .locator('select')
      .selectOption('sepia', { timeout: 6000 });
    await page.waitForTimeout(600);
    await shot('07-reader-sepia');
  });

  await step('toc', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await showUi();
    await clickTitle('תוכן עניינים (T)');
    await page.waitForSelector('.toc-list', { timeout: 6000 });
    await shot('08-reader-toc');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  await step('authors', async () => {
    await showUi();
    await clickTitle('חזרה (Esc)');
    await page.waitForSelector('.book-list', { timeout: 10000 });
    await clickTitle('תפריט');
    await clickDrawerItem('מחברים');
    await page.waitForSelector('.author-card', { timeout: 10000 });
    await shot('09-authors');
  });

  await step('settings', async () => {
    await clickTitle('תפריט');
    await clickDrawerItem('הגדרות');
    await page.waitForSelector('.settings-view', { timeout: 10000 });
    await shot('10-settings');
  });

  await step('trash', async () => {
    await clickTitle('תפריט');
    await clickDrawerItem('אשפה');
    await page.waitForTimeout(800);
    await shot('11-trash');
  });

  await step('reading now', async () => {
    await clickTitle('תפריט');
    await clickDrawerItem('קורא עכשיו');
    await page.waitForSelector('.book-row', { timeout: 10000 });
    await shot('01-reading-now');
  });

  await step('selection', async () => {
    await ensureNoSelection();
    await clickTitle('תפריט');
    await clickDrawerItem('ספרים ומסמכים');
    await page.waitForSelector('.book-row', { timeout: 10000 });
    // selection starts from the tick on the cover – a row tap opens the book
    await page.locator('.book-row').nth(0).hover();
    await page.locator('.book-row').nth(0).locator('.select-tick').click();
    await page.locator('.book-row').nth(1).locator('.select-tick').click();
    await page.waitForSelector('.selection-bar', { timeout: 6000 });
    await shot('13-selection');
    await clickTitle('בטל בחירה (Esc)');
    await page.waitForTimeout(300);
  });

  /** A real mouse drag over a paragraph – exactly how a reader selects text. */
  const dragSelect = async (index = 0) => {
    const p = page.locator('.book-chapter p').nth(index);
    await p.scrollIntoViewIfNeeded();
    const box = await p.boundingBox();
    if (!box) throw new Error('paragraph has no box');
    const y = box.y + Math.min(18, box.height / 2);
    // Hebrew runs right-to-left: start on the right edge and pull left
    await page.mouse.move(box.x + box.width - 6, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.32, y, { steps: 14 });
    await page.mouse.up();
    const text = await page.evaluate(() => window.getSelection().toString().trim());
    trace(`selected ${text.length} chars`);
    return text;
  };

  await step('highlights', async () => {
    await ensureNoSelection();
    await clickTitle('תפריט');
    await clickDrawerItem('ספרים ומסמכים');
    await page.waitForSelector('.book-row', { timeout: 10000 });
    await page.locator('.book-row h3').filter({ hasText: 'הספר הישן' }).first().click();
    await page.waitForSelector('.book-detail', { timeout: 10000 });
    await page.locator('.bd-read').click();
    await page.waitForSelector('.book-scroll', { timeout: 45000 });
    await page.waitForTimeout(800);

    await dragSelect(0);
    await page.waitForSelector('.sel-bar', { timeout: 6000 });
    await shot('14-selection-bar');

    await page.locator('.sel-dot.dot-yellow').click();
    await page.waitForSelector('mark.shoso-hl', { timeout: 6000 });
    await page.waitForTimeout(300);

    await dragSelect(5);
    await page.waitForSelector('.sel-bar', { timeout: 6000 });
    await page.locator('.sel-dot.dot-blue').click();
    await page.waitForTimeout(400);

    await showUi();
    await clickTitle('הדגשות');
    await page.waitForSelector('.highlights-list', { timeout: 6000 });
    await shot('15-highlights');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  await step('automatic reading', async () => {
    await showUi();
    await clickTitle('קריאה אוטומטית (P)');
    await page.waitForTimeout(1600);
    await showUi();
    await shot('16-auto-reading');
    await clickTitle('קריאה אוטומטית (P)');
    await page.waitForTimeout(300);
    await showUi();
    await clickTitle('חזרה (Esc)');
    await page.waitForSelector('.book-list', { timeout: 10000 });
  });

  await step('book detail', async () => {
    await ensureNoSelection();
    await clickTitle('תפריט');
    await clickDrawerItem('ספרים ומסמכים');
    await page.waitForSelector('.book-row', { timeout: 10000 });
    await page.locator('.book-row h3').filter({ hasText: 'הספר הישן' }).first().click();
    await page.waitForSelector('.book-detail', { timeout: 10000 });
    // the annotation is read from the file itself – wait for it, not for a timer
    await page.waitForSelector('.bd-desc:not(.loading)', { timeout: 15000 });
    await shot('12-book-detail');
  });
} catch (err) {
  console.error('screenshot run failed:', err.message);
  writeFileSync(`${OUT}/99-error.txt`, `fatal: ${err.message}\n`, 'utf8');
  await page.screenshot({ path: `${OUT}/99-failure.png` }).catch(() => {});
} finally {
  await browser.close();
}

trace('done');
