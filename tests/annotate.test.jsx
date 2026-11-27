import { describe, it, expect } from 'vitest';
import {
  wrapQuote, clearHighlights, paintHighlights, stripNiqqudHtml, stripNiqqud,
  normalizeSpace, shortQuote, HIGHLIGHT_COLORS,
} from '../src/lib/annotate.js';

const VOWELLED = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים';
const PLAIN = 'בראשית ברא אלהים';

const mount = (html) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
};

describe('annotate', () => {
  it('strips niqqud from text but not from markup', () => {
    expect(stripNiqqud(VOWELLED)).toBe(PLAIN);
    expect(stripNiqqudHtml(`<p title="שָׁלוֹם">${VOWELLED}</p>`))
      .toBe(`<p title="שָׁלוֹם">${PLAIN}</p>`);
  });

  it('collapses whitespace and shortens the floating label', () => {
    expect(normalizeSpace('  שלום \n\n עולם  ')).toBe('שלום עולם');
    expect(shortQuote('א'.repeat(80), 10)).toBe(`${'א'.repeat(10)}…`);
  });

  it('wraps a plain quote in a coloured mark', () => {
    const root = mount(`<p>${PLAIN}</p>`);
    expect(wrapQuote(root, 'ברא אלהים', 'green')).toBe(true);
    const mark = root.querySelector('mark.shoso-hl');
    expect(mark).toBeTruthy();
    expect(mark.className).toContain('hl-green');
    expect(mark.textContent).toBe('ברא אלהים');
    expect(root.textContent).toBe(PLAIN);
  });

  it('finds a highlight stored with niqqud after the niqqud is hidden', () => {
    const root = mount(`<p>${PLAIN}</p>`);
    expect(wrapQuote(root, VOWELLED, 'yellow')).toBe(true);
    expect(root.querySelector('mark.shoso-hl').textContent).toBe(PLAIN);
  });

  it('matches across a line break and across nodes', () => {
    const root = mount('<p>בראשית <b>ברא</b>\nאלהים</p>');
    expect(wrapQuote(root, 'בראשית ברא אלהים')).toBe(true);
    // every character was covered once, nothing was lost
    expect(root.textContent.replace(/\s+/g, ' ')).toBe('בראשית ברא אלהים');
    expect(root.querySelectorAll('mark.shoso-hl').length).toBeGreaterThan(1);
  });

  it('repaints without duplicating and clears cleanly', () => {
    const root = mount(`<p>${PLAIN}</p>`);
    const highlights = [
      { quote: 'בראשית', color: 'yellow' },
      { quote: 'אלהים', color: 'blue' },
    ];
    paintHighlights(root, highlights);
    paintHighlights(root, highlights);
    expect(root.querySelectorAll('mark.shoso-hl').length).toBe(2);
    expect([...root.querySelectorAll('mark.shoso-hl')].map((m) => m.textContent))
      .toEqual(['בראשית', 'אלהים']);
    clearHighlights(root);
    expect(root.querySelectorAll('mark.shoso-hl').length).toBe(0);
    expect(root.textContent).toBe(PLAIN);
  });

  it('ignores quotes that are not in the chapter', () => {
    const root = mount('<p>טקסט אחר לגמרי</p>');
    expect(wrapQuote(root, 'משפט שלא קיים')).toBe(false);
    expect(root.querySelector('mark')).toBeNull();
  });

  it('ships four ReadEra-like colours', () => {
    expect(HIGHLIGHT_COLORS.map((c) => c.id)).toEqual(['yellow', 'green', 'blue', 'pink']);
  });
});
