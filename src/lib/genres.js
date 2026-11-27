/**
 * Genres / styles.
 *
 * Books carry a genre in their own metadata – `dc:subject` in an EPUB,
 * `<genre>` in an FB2 – and that is what ReadEra groups by. The labels come in
 * three flavours: Hebrew sentences, English subjects ("Science Fiction"), and
 * FB2 codes ("sf_history"). Everything funnels through here so the shelf shows
 * one tidy name per idea, and so a book with no metadata can be tagged by hand.
 */

/** FB2 genre codes that actually show up in the wild. */
const FB2_CODES = {
  sf: 'מדע בדיוני',
  sf_history: 'מדע בדיוני היסטורי',
  sf_action: 'מדע בדיוני פעולה',
  sf_epic: 'מדע בדיוני אפי',
  sf_heroic: 'מדע בדיוני גבורים',
  sf_detective: 'מדע בדיוני בלשי',
  sf_humor: 'מדע בדיוני הומור',
  sf_fantasy: 'פנטזיה',
  fantasy: 'פנטזיה',
  fantasy_epic: 'פנטזיה אפית',
  fantasy_heroic: 'פנטזיה גבורית',
  humor: 'הומור',
  humor_satire: 'סאטירה',
  detective: 'מתח ובלשים',
  detective_police: 'מתח משטרתי',
  thriller: 'מתח',
  horror: 'אימה',
  prose_classic: 'קלאסיקה',
  prose_rus_classic: 'קלאסיקה',
  prose_history: 'רומן היסטורי',
  prose_counter: 'פרוזה מודרנית',
  prose_military: 'פרוזה צבאית',
  prose_detective: 'מתח ובלשים',
  prose_shortstory: 'סיפורים קצרים',
  prose_children: 'ילדים ונוער',
  child_prose: 'ילדים ונוער',
  child_tale: 'אגדות',
  child_verse: 'שירה לילדים',
  poetry: 'שירה',
  love: 'רומן רומנטי',
  love_sf: 'רומנטי-מדע בדיוני',
  adv_history: 'הרפתקאות היסטוריות',
  adventure: 'הרפתקאות',
  nonf_biography: 'ביוגרפיה',
  nonf_publicism: 'עיון ופובליציסטיקה',
  nonf_criticism: 'ביקורת',
  nonfiction: 'עיון',
  science: 'מדע',
  religion: 'דת ורוח',
  religion_esoterics: 'רוח ומיסטיקה',
  philosophy: 'פילוסופיה',
  psychology: 'פסיכולוגיה',
  history: 'היסטוריה',
  politics: 'פוליטיקה',
  economics: 'כלכלה',
  business: 'עסקים',
  computers: 'מחשבים',
  reference: 'עיון',
  sci_textbook: 'ספר לימוד',
  sci_linguistic: 'בלשנות',
  folklore: 'פולקלור',
  epic: 'אפוס',
  drama: 'מחזות',
  antique: 'ספרות עתיקה',
  military_history: 'היסטוריה צבאית',
};

/** English subjects that are common enough to be worth translating. */
const ENGLISH = [
  [/science[- ]?fiction|sci[- ]?fi/i, 'מדע בדיוני'],
  [/fantasy/i, 'פנטזיה'],
  [/detective|mystery|crime/i, 'מתח ובלשים'],
  [/thriller|suspense/i, 'מתח'],
  [/horror/i, 'אימה'],
  [/romance/i, 'רומן רומנטי'],
  [/historical/i, 'רומן היסטורי'],
  [/biograph|memoir|autobiograph/i, 'ביוגרפיה'],
  [/poetry|poems|verse/i, 'שירה'],
  [/drama|play|theatre|theater/i, 'מחזות'],
  [/child|juvenile|young adult/i, 'ילדים ונוער'],
  [/history/i, 'היסטוריה'],
  [/philosoph/i, 'פילוסופיה'],
  [/psycholog/i, 'פסיכולוגיה'],
  [/religio|spiritual|theolog/i, 'דת ורוח'],
  [/business|econom|management|finance/i, 'עסקים'],
  [/comput|programming|software/i, 'מחשבים'],
  [/science|physics|biology|chemistry|math/i, 'מדע'],
  [/non[- ]?fiction|essays/i, 'עיון'],
  [/fiction|novel|literature|literary|classics/i, 'פרוזה'],
  [/humou?r|comedy|satire/i, 'הומור'],
  [/short stories|anthology/i, 'סיפורים קצרים'],
  [/adventure/i, 'הרפתקאות'],
  [/cooking|food/i, 'בישול'],
  [/travel/i, 'מסעות'],
  [/health|self[- ]help|wellness/i, 'בריאות וכושר'],
];

const MAX_GENRES = 6;

/** One raw label -> a readable, stable name (or '' when it is noise). */
export function normalizeGenre(raw) {
  const value = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!value || value.length > 48) return '';
  const code = value.toLowerCase().replace(/[\s-]+/g, '_');
  if (FB2_CODES[code]) return FB2_CODES[code];
  if (FB2_CODES[value.toLowerCase()]) return FB2_CODES[value.toLowerCase()];
  for (const [pattern, label] of ENGLISH) {
    if (pattern.test(value)) return label;
  }
  // "Hebrew, Fiction, Israeli" style lists: keep the words, drop the punctuation
  const clean = value.replace(/^[\s,;:./|-]+|[\s,;:./|-]+$/g, '');
  if (!clean || clean.length < 2) return '';
  if (/^[0-9\s.-]+$/.test(clean)) return '';
  // BISAC-style dotted codes are unreadable – keep the last, human part
  if (clean.includes('/') && /^[A-Z]{3}/.test(clean)) {
    const last = clean.split('/').pop().trim();
    return last ? normalizeGenre(last) : '';
  }
  return clean;
}

/** Every genre of a book entry, deduped and capped. */
export function bookGenres(book) {
  const raw = Array.isArray(book?.genres) ? book.genres : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    for (const part of String(item || '').split(/[,;|]/)) {
      const label = normalizeGenre(part);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
      if (out.length >= MAX_GENRES) return out;
    }
  }
  return out;
}

/** Genre -> books, biggest shelves first, then alphabetical (Hebrew aware). */
export function genresList(books) {
  const map = new Map();
  for (const book of books || []) {
    for (const genre of bookGenres(book)) {
      const entry = map.get(genre) || { genre, count: 0, books: [] };
      entry.count += 1;
      entry.books.push(book);
      map.set(genre, entry);
    }
  }
  const collator = new Intl.Collator('he', { sensitivity: 'base' });
  return [...map.values()].sort((a, b) => b.count - a.count || collator.compare(a.genre, b.genre));
}

/** Books of one genre (case-insensitive, niqqud-tolerant enough for shelves). */
export function booksOfGenre(books, genre) {
  const target = String(genre || '').trim().toLowerCase();
  if (!target) return [];
  return (books || []).filter((b) => bookGenres(b).some((g) => g.toLowerCase() === target));
}

/** Clean a hand-typed genre list before it is stored. */
export function parseGenreInput(value) {
  return bookGenres({ genres: [value] });
}
