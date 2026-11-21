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

const clickTitle = async (title) => {
  const el = page.locator(`[title="${title}"]`).first();
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
    await clickText('ספרים ומסמכים');
    await page.waitForSelector('.book-list', { timeout: 6000 });
    // use the real row actions so the gold "active" chips are genuine state
    await page.locator('.book-row').nth(1).locator('.row-actions .icon-btn').nth(0).click();
    await page.locator('.book-row').nth(2).locator('.row-actions .icon-btn').nth(1).click();
    await page.locator('.book-row').nth(3).locator('.row-actions .icon-btn').nth(2).click();
    await page.waitForTimeout(400);
    await shot('03-books-list');
  });

  await step('books tiles', async () => {
    await clickTitle('תצוגת כריכות');
    await page.waitForSelector('.book-tile', { timeout: 6000 });
    await shot('04-books-tiles');
    await clickTitle('תצוגת רשימה');
    await page.waitForSelector('.book-list', { timeout: 6000 });
  });

  await step('reader', async () => {
    // the EPUB demo book is the long one – open it by title
    await page.locator('.book-row h3').filter({ hasText: 'הספר הישן' }).first().click();
    await page.waitForSelector('.book-scroll', { timeout: 45000 });
    await page.mouse.move(700, 450);
    await page.waitForTimeout(700);
    // real reading progress so "Reading Now" is meaningful later
    await page.mouse.wheel(0, 2400);
    await page.waitForTimeout(1400);
    await page.mouse.move(700, 450);
    await shot('05-reader-night');
  });

  await step('reader settings', async () => {
    await clickTitle('הגדרות קריאה (A)');
    await page.waitForSelector('.reader-settings', { timeout: 6000 });
    await shot('06-reader-settings');
  });

  await step('sepia mode', async () => {
    await page.locator('.rs-mode[title="ספיה"]').click({ timeout: 6000 });
    await page.waitForTimeout(600);
    await shot('07-reader-sepia');
  });

  await step('toc', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.mouse.move(700, 450);
    await clickTitle('תוכן עניינים (T)');
    await page.waitForSelector('.toc-list', { timeout: 6000 });
    await shot('08-reader-toc');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  await step('authors', async () => {
    await page.mouse.move(700, 450);
    await clickTitle('חזרה (Esc)');
    await page.waitForSelector('.book-list', { timeout: 10000 });
    await clickTitle('תפריט');
    await clickText('מחברים');
    await page.waitForSelector('.author-card', { timeout: 10000 });
    await shot('09-authors');
  });

  await step('settings', async () => {
    await clickTitle('תפריט');
    await clickText('הגדרות');
    await page.waitForSelector('.settings-view', { timeout: 10000 });
    await shot('10-settings');
  });

  await step('trash', async () => {
    await clickTitle('תפריט');
    await clickText('אשפה');
    await page.waitForTimeout(800);
    await shot('11-trash');
  });

  await step('reading now', async () => {
    await clickTitle('תפריט');
    await clickText('קורא עכשיו');
    await page.waitForSelector('.book-row', { timeout: 10000 });
    await shot('01-reading-now');
  });
} catch (err) {
  console.error('screenshot run failed:', err.message);
  writeFileSync(`${OUT}/99-error.txt`, `fatal: ${err.message}\n`, 'utf8');
  await page.screenshot({ path: `${OUT}/99-failure.png` }).catch(() => {});
} finally {
  await browser.close();
}

trace('done');
