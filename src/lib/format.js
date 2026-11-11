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

export const formatBitrate = (bps) => (bps ? `${Math.round(bps / 1000)} kbps` : '—');

export const hebrewCount = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

/** Strip Hebrew niqqud so search matches plain letters. */
export const stripNiqqud = (text) =>
  String(text || '').replace(/[\u0591-\u05C7]/g, '');

const hebrewCollator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });

export const collate = (a, b) => hebrewCollator.compare(String(a || ''), String(b || ''));

export const normalize = (text) => stripNiqqud(text).toLowerCase().trim();

/** Build a searchable haystack for a track. */
export const trackHaystack = (track) =>
  normalize([track.title, track.artist, track.album, track.albumArtist, track.genre, track.year, track.fileName]
    .filter(Boolean)
    .join(' '));

export const matchesQuery = (haystack, query) => {
  if (!query) return true;
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
};

export const artistsOf = (track) =>
  String(track.artist || '')
    .split(/\s*(?:,|;|\/|feat\.?|ft\.?|&| x |×)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

export const primaryArtist = (track) => artistsOf(track)[0] || track.artist || 'אמן לא ידוע';

export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('');

/** Deterministic HSL colour from a string – used for gradient placeholders. */
export const colorFromString = (text) => {
  let hash = 0;
  const str = String(text || '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 360;
  }
  return hash;
};
