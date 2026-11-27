/**
 * Update checks.
 *
 * The app itself is completely offline – the library, the books and the
 * settings all live on the machine. The only thing that ever goes to the
 * network is this check, and it only asks GitHub for the latest release tag.
 */

/** "v1.7.0" / "1.7.0-beta.2" -> [1, 7, 0] (a prerelease counts as its base). */
export function parseVersion(value) {
  const clean = String(value || '').trim().replace(/^v/i, '');
  const base = clean.split(/[-+]/)[0];
  return base.split('.').map((part) => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** Is `candidate` a later release than `current`? */
export function isNewer(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a.length || !a.some((n) => n > 0)) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/** The installer for a tag, if the release page only tells us the tag. */
export function setupAssetUrl(tag, assets) {
  const version = String(tag || '').replace(/^v/i, '');
  const hit = (assets || []).find((a) => /Setup/i.test(a.name) && /\.exe$/i.test(a.name));
  if (hit) return hit.url;
  return version
    ? `https://github.com/i0534145445-bot/SHOSO/releases/download/v${version}/SHOSO-Books-Setup-${version}.exe`
    : '';
}

export const releasePageUrl = (tag) => (tag
  ? `https://github.com/i0534145445-bot/SHOSO/releases/tag/v${String(tag).replace(/^v/i, '')}`
  : 'https://github.com/i0534145445-bot/SHOSO/releases');

/** The one-line status under "עדכונים". */
export function updateStatusLine(updates, currentVersion) {
  const status = updates?.status || 'idle';
  if (status === 'checking') return 'בודק…';
  if (status === 'available') return `גרסה ${updates.latest} זמינה`;
  if (status === 'current') return 'מעודכן לגרסה האחרונה';
  if (status === 'offline') return 'אין חיבור – נבדוק בפעם הבאה';
  if (status === 'unsupported') return 'רק באפליקציה המותקנת';
  return currentVersion ? `גרסה ${currentVersion}` : '';
}
