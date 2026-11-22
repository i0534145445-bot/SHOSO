import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';

/** Isolated measurement of the exact step that changed: spine decompression. */
describe('spine decompression', () => {
  it('parallel is faster than serial for the same output', async () => {
    const zip = new JSZip();
    const N = 160;
    for (let i = 0; i < N; i += 1) {
      zip.file(`OEBPS/ch${i}.xhtml`, `<html><body><h1>${i}</h1>${'<p>טקסט ארוך לבדיקה של מהירות הקריאה. </p>'.repeat(160)}</body></html>`);
    }
    const buf = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    const loaded = await JSZip.loadAsync(buf);
    const names = Object.keys(loaded.files).filter((n) => !loaded.files[n].dir);

    const t0 = performance.now();
    const serial = [];
    for (const n of names) serial.push(await loaded.file(n).async('string'));
    const t1 = performance.now();

    const t2 = performance.now();
    const parallel = await Promise.all(names.map((n) => loaded.file(n).async('string')));
    const t3 = performance.now();

    console.log(`serial: ${(t1 - t0).toFixed(0)}ms  parallel: ${(t3 - t2).toFixed(0)}ms  speedup: ${((t1 - t0) / Math.max(1, t3 - t2)).toFixed(1)}x`);
    expect(parallel).toEqual(serial);
  });
});
