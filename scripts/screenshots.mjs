/**
 * Real screenshots of SHOSO Books (browser mode = same UI as the EXE).
 * Requires the built app served at http://localhost:4173 (set SCREENSHOT_URL to override).
 *
 * Every PNG below is a genuine capture of the running app — no mockups.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.SCREENSHOT_URL || 'http://localhost:4173';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const shot = async (name) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('saved', name);
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
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // demo books are seeded automatically in browser mode
  await page.waitForSelector('.book-row', { timeout: 30000 });

  // navigation drawer
  await clickTitle('תפריט');
  await page.waitForSelector('.drawer', { timeout: 5000 });
  await shot('02-drawer');
  await clickText('ספרים ומסמכים');
  await page.waitForSelector('.book-list', { timeout: 5000 });
  await shot('03-books-list');

  // cover grid
  await clickTitle('תצוגת כריכות');
  await page.waitForSelector('.book-tile', { timeout: 5000 });
  await shot('04-books-tiles');
  await clickTitle('תצוגת רשימה');

  // open the first book
  await page.locator('.book-row').first().click();
  await page.waitForSelector('.book-scroll', { timeout: 30000 });
  await page.mouse.move(700, 450);
  await page.waitForTimeout(600);
  // real reading progress so "Reading Now" is meaningful later
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(900);
  await page.mouse.move(700, 450);
  await shot('05-reader-night');

  // reading settings drawer → sepia mode
  await clickTitle('הגדרות קריאה (A)');
  await page.waitForSelector('.reader-settings', { timeout: 5000 });
  await shot('06-reader-settings');
  await page.locator('.rs-mode[title="ספיה"]').click();
  await page.waitForTimeout(500);
  await shot('07-reader-sepia');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // table of contents
  await page.mouse.move(700, 450);
  await clickTitle('תוכן עניינים (T)');
  await page.waitForSelector('.toc-list', { timeout: 5000 });
  await shot('08-reader-toc');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // back to the library, then the remaining screens
  await page.mouse.move(700, 450);
  await clickTitle('חזרה (Esc)');
  await page.waitForSelector('.book-list', { timeout: 8000 });

  await clickTitle('תפריט');
  await clickText('מחברים');
  await page.waitForSelector('.author-card', { timeout: 8000 });
  await shot('09-authors');

  await clickTitle('תפריט');
  await clickText('הגדרות');
  await page.waitForSelector('.settings-view', { timeout: 8000 });
  await shot('10-settings');

  await clickTitle('תפריט');
  await clickText('אשפה');
  await page.waitForTimeout(600);
  await shot('11-trash');

  // landing screen last, now that a book has real reading progress
  await clickTitle('תפריט');
  await clickText('קורא עכשיו');
  await page.waitForSelector('.book-row', { timeout: 8000 });
  await shot('01-reading-now');
} catch (err) {
  console.error('screenshot run failed:', err.message);
  await page.screenshot({ path: `${OUT}/99-failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}

console.log('done');
