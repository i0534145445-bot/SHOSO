/**
 * Real screenshots of SHOSO Books (browser mode = same UI as the EXE).
 * Run with: node scripts/screenshots.mjs  (requires playwright + a preview server)
 * Expects the built app served at http://localhost:4173
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.SCREENSHOT_URL || 'http://localhost:4173';
const shot = async (page, name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE, { waitUntil: 'networkidle' });
await shot(page, '01-home-empty');

// Load demo books via Settings
await page.getByText('הגדרות', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.getByText(/טען ספרי דמו/).first().click();
await page.waitForTimeout(2500);

// Home with books (continue reading / recent)
await page.getByText('בית', { exact: true }).first().click();
await shot(page, '02-home-books');

// Library grid
await page.getByText('ספרייה', { exact: true }).first().click();
await shot(page, '03-library-grid');

// Open the EPUB demo book (first "קרא" button)
await page.getByRole('button', { name: /קרא|המשך/ }).first().click();
await page.waitForTimeout(3000);
await shot(page, '04-reader-epub');

// Reader: TOC panel
await page.keyboard.press('t');
await shot(page, '05-reader-toc');

// Reader: settings panel
await page.keyboard.press('a');
await shot(page, '06-reader-settings');

// Back to library, authors view
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
await page.getByText('מחברים', { exact: true }).first().click();
await shot(page, '07-authors');

// Settings view
await page.getByText('הגדרות', { exact: true }).first().click();
await shot(page, '08-settings');

await browser.close();
console.log('done');
