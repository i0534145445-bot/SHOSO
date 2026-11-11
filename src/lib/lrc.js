/**
 * LRC / plain-text lyric parsing + active-line lookup.
 * Supports [mm:ss.xx] timestamps, multiple stamps per line, and metadata tags.
 */

const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(text) {
  if (!text || typeof text !== 'string') return { lines: [], meta: {} };
  const lines = [];
  const meta = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Metadata such as [ar:Artist]
    const metaMatch = /^\[(ti|ar|al|by|offset|re|ve):(.*)\]$/i.exec(line);
    if (metaMatch) {
      meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      continue;
    }

    const stamps = [...line.matchAll(STAMP)];
    if (!stamps.length) {
      // plain (unsynced) line
      lines.push({ time: null, text: titleCaseKeep(line) });
      continue;
    }

    const content = line.replace(STAMP, '').trim();
    for (const stamp of stamps) {
      const minutes = parseInt(stamp[1], 10);
      const seconds = parseInt(stamp[2], 10);
      const fraction = stamp[3] ? parseInt(stamp[3], 10) / (stamp[3].length === 3 ? 1000 : 100) : 0;
      lines.push({ time: minutes * 60 + seconds + fraction, text: content });
    }
  }

  const timed = lines.filter((l) => l.time !== null);
  const isSynced = timed.length > 0;
  if (isSynced) {
    lines.sort((a, b) => a.time - b.time);
    const offset = meta.offset ? parseFloat(meta.offset) / 1000 : 0;
    if (offset) lines.forEach((l) => (l.time += offset));
  }

  return { lines: lines.filter((l) => l.text.length || l.time !== null), meta, isSynced };
}

const titleCaseKeep = (s) => s;

/** Index of the currently sung line, or -1 before the first timestamp. */
export function activeLineIndex(lines, currentTime) {
  if (!lines || !lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = lines[mid].time;
    if (t === null || t === undefined) return -1;
    if (t <= currentTime + 0.15) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
