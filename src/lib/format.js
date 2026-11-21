/**
 * Small helpers for formatting + normalising text (Hebrew-aware).
 */

export const formatTime = (seconds, { hours } = {}) => {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (hours || h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatSize = (bytes) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

export const formatDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatRelative = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return formatDate(ts);
};

export const formatReadingTime = (seconds) => {
  if (!seconds || seconds < 60) return seconds ? `${Math.round(seconds)} שניות` : '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} דק׳ קריאה`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} שע׳ ${m} דק׳` : `${h} שע׳`;
};

export const formatWordCount = (n) => {
  if (!n) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M מילים`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K מילים`;
  return `${n} מילים`;
};

export const hebrewCount = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

/** Strip Hebrew niqqud so search matches plain letters. */
export const stripNiqqud = (text) =>
  String(text || '').replace(/[\u0591-\u05C7]/g, '');

const hebrewCollator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });

export const collate = (a, b) => hebrewCollator.compare(String(a || ''), String(b || ''));

export const normalize = (text) => stripNiqqud(text).toLowerCase().trim();

/** Build a searchable haystack for a book. */
export const bookHaystack = (book) =>
  normalize([book.title, book.author, book.format, book.fileName, book.language]
    .filter(Boolean)
    .join(' '));

export const matchesQuery = (haystack, query) => {
  if (!query) return true;
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
};

export const authorsOf = (book) =>
  String(book.author || '')
    .split(/\s*(?:,|;|\/|feat\.?|ft\.?|&| x |×)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

export const primaryAuthor = (book) => authorsOf(book)[0] || book.author || 'מחבר לא ידוע';

export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('');

/** Deterministic HSL colour from a string – used for generated covers. */
export const colorFromString = (text) => {
  let hash = 0;
  const str = String(text || '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 360;
  }
  return hash;
};

/** Detect RTL vs LTR from text (Hebrew/Arabic letters). */
export const detectDirection = (text) => {
  const sample = String(text || '').slice(0, 2000);
  const hebrew = (sample.match(/[\u0590-\u05FF]/g) || []).length;
  const arabic = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  return hebrew + arabic > latin ? 'rtl' : 'ltr';
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const escapeHtml = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
