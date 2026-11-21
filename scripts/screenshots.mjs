/**
 * Real screenshots of SHOSO Books (browser mode = same UI as the EXE).
 * Requires the built app served at http://localhost:4173 (set SCREENSHOT_URL to override).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.SCREENSHOT_URL || 'http://localhost:4173';
const shot = async (page, name) => {
  await page.waitForTimeout(700);
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log('saved', name);
  } catch (e) {
    console.error('failed screenshot', name, e.message);
  }
};

const tryClick = async (page, selector, label) => {
  try {
    const el = page.getByText(selector, { exact: true }).first();
    await el.waitFor({ state: 'visible', timeout: 4000 });
    await el.click();
    console.log('clicked', label);
    return true;
  } catch (e) {
    console.warn('skip click', label, e.message);
    return false;
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(BASE, { waitUntil: 'networkidle' });
await shot(page, '01-home-empty');

// Try to load demo books via Settings
await tryClick(page, 'הגדרות', 'settings');
await tryClick(page, 'טען ספרי דמו', 'load demo books');
await page.waitForTimeout(2500);

// Home with books
await tryClick(page, 'בית', 'home');
await shot(page, '02-home-books');

// Library grid
await tryClick(page, 'ספרייה', 'library');
await shot(page, '03-library-grid');

// Open first readable book
await tryClick(page, 'קרא', 'read epub');
await tryClick(page, 'המשך', 'continue');
await page.waitForTimeout(3000);
await shot(page, '04-reader-epub');

// Reader panels
await page.keyboard.press('t').catch(() => {});
await shot(page, '05-reader-toc');
await page.keyboard.press('a').catch(() => {});
await shot(page, '06-reader-settings');

// Back out, then authors + settings views
await page.keyboard.press('Escape').catch(() => {});
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(800);
await tryClick(page, 'מחברים', 'authors');
await shot(page, '07-authors');
await tryClick(page, 'הגדרות', 'settings again');
await shot(page, '08-settings');

await browser.close();
console.log('done');
