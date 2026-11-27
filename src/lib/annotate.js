/**
 * Marks inside rendered book text.
 *
 * Highlights are stored as text quotations (the exact sentence the reader
 * selected) plus a colour, because a stored DOM position breaks the moment the
 * typography changes. Painting them works on the rendered page: every quote is
 * found in the text nodes, wrapped in a <mark>, and removed again before the
 * next paint – so re-rendering a chapter never leaves duplicates behind.
 *
 * Quotes are matched after dropping niqqud and collapsing whitespace on both
 * sides, so a highlight survives the vocalisation toggle and the line breaks
 * that change with the font size.
 */

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'צהוב' },
  { id: 'green', label: 'ירוק' },
  { id: 'blue', label: 'תכלת' },
  { id: 'pink', label: 'ורוד' },
];

const MARK = 'mark.shoso-hl';

/* Hebrew niqqud + cantillation (U+0591 – U+05C7), compared by code point so
   the file needs no escaped ranges. */
const NIQ_START = 0x0591;
const NIQ_END = 0x05c7;

export const isNiqqud = (ch) => {
  const code = ch.codePointAt(0);
  return code >= NIQ_START && code <= NIQ_END;
};

const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\u00a0';

/** Remove niqqud from a plain string. */
export function stripNiqqud(text) {
  let out = '';
  for (const ch of String(text || '')) {
    if (!isNiqqud(ch)) out += ch;
  }
  return out;
}

/** Remove niqqud from an HTML string, leaving every tag and attribute intact. */
export function stripNiqqudHtml(html) {
  let out = '';
  let inTag = false;
  const source = String(html || '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '<') inTag = true;
    if (!inTag && isNiqqud(ch)) continue;
    out += ch;
    if (ch === '>') inTag = false;
  }
  return out;
}

export const normalizeSpace = (value) => {
  let out = '';
  for (const ch of String(value || '')) {
    if (isSpace(ch)) {
      if (out && !out.endsWith(' ')) out += ' ';
    } else {
      out += ch;
    }
  }
  return out.trim();
};

/** Remove every highlight currently painted in `root`. */
export function clearHighlights(root) {
  if (!root) return;
  root.querySelectorAll(MARK).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

/** Every text node under `root`, in reading order. */
function textNodes(root) {
  const out = [];
  if (!root || !root.ownerDocument) return out;
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */, null);
  let node = walker.nextNode();
  while (node) {
    const name = node.parentNode && node.parentNode.nodeName;
    if (name !== 'SCRIPT' && name !== 'STYLE') out.push(node);
    node = walker.nextNode();
  }
  return out;
}

/**
 * The rendered text of `nodes`, ready for a quote comparison, plus the node and
 * offset each character came from.
 */
function flatten(nodes) {
  let text = '';
  const where = [];
  nodes.forEach((node) => {
    const value = node.nodeValue || '';
    for (let offset = 0; offset < value.length; offset += 1) {
      const ch = value[offset];
      if (isNiqqud(ch)) continue;
      if (isSpace(ch)) {
        if (text.endsWith(' ')) continue; // collapse a run of whitespace
        text += ' ';
      } else {
        text += ch;
      }
      where.push({ node, offset });
    }
  });
  return { text, where };
}

/**
 * Wrap the first occurrence of `quote` in `root`. A quote may span several
 * nodes (a bold word in the middle of a sentence), so the match is made against
 * the flattened text and then mapped back onto the nodes it covers.
 */
export function wrapQuote(root, quote, color = 'yellow') {
  const target = normalizeSpace(stripNiqqud(quote));
  if (!root || target.length < 2) return false;

  const nodes = textNodes(root);
  if (!nodes.length) return false;

  const { text, where } = flatten(nodes);
  const at = text.toLowerCase().indexOf(target.toLowerCase());
  if (at < 0) return false;

  const first = where[at];
  const last = where[at + target.length - 1];
  if (!first || !last) return false;

  // Group the covered characters by node: from/to per node, back to front.
  const bounds = new Map();
  for (let i = at; i < at + target.length; i += 1) {
    const hit = where[i];
    if (!hit) continue;
    const current = bounds.get(hit.node);
    if (!current) bounds.set(hit.node, { from: hit.offset, to: hit.offset + 1 });
    else {
      current.from = Math.min(current.from, hit.offset);
      current.to = Math.max(current.to, hit.offset + 1);
    }
  }

  const plan = [...bounds.entries()];
  let painted = false;
  for (let i = plan.length - 1; i >= 0; i -= 1) {
    const [node, { from, to }] = plan[i];
    if (!node.parentNode || to <= from) continue;
    const range = node.ownerDocument.createRange();
    range.setStart(node, from);
    range.setEnd(node, to);
    const mark = node.ownerDocument.createElement('mark');
    mark.className = `shoso-hl hl-${color}`;
    try {
      range.surroundContents(mark);
      painted = true;
    } catch {
      /* a node split across elements – skip that fragment */
    }
  }
  return painted;
}

/** Paint every highlight of the book, in order of creation. */
export function paintHighlights(root, highlights) {
  if (!root) return;
  clearHighlights(root);
  (highlights || []).forEach((h) => wrapQuote(root, h.quote, h.color));
}

/** Remove Hebrew niqqud from text already in the DOM (markup untouched). */
export function stripNiqqudIn(root) {
  if (!root) return;
  textNodes(root).forEach((node) => {
    if (stripNiqqud(node.nodeValue) !== node.nodeValue) node.nodeValue = stripNiqqud(node.nodeValue);
  });
}

/** The floating bar's label: never longer than a sentence fragment. */
export const shortQuote = (text, max = 60) => {
  const clean = normalizeSpace(text);
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
};
