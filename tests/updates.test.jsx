import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { isNewer, parseVersion, setupAssetUrl, releasePageUrl, updateStatusLine } from '../src/lib/updates.js';
import { bootstrap, getState, setState, checkForUpdate, setUpdatesOption } from '../src/lib/store.js';

beforeAll(async () => {
  await bootstrap();
});

describe('version comparison', () => {
  it('reads tags with or without the v prefix', () => {
    expect(parseVersion('v1.7.0')).toEqual([1, 7, 0]);
    expect(parseVersion('1.7.0')).toEqual([1, 7, 0]);
    expect(parseVersion('v2.0.0-beta.1')).toEqual([2, 0, 0]);
    expect(parseVersion('')).toEqual([0]);
  });

  it('knows which release is newer', () => {
    expect(isNewer('1.7.1', '1.7.0')).toBe(true);
    expect(isNewer('v1.8.0', '1.7.9')).toBe(true);
    expect(isNewer('1.10.0', '1.9.9')).toBe(true);
    expect(isNewer('2.0', '1.99.99')).toBe(true);
    expect(isNewer('1.7.0', '1.7.0')).toBe(false);
    expect(isNewer('1.6.9', '1.7.0')).toBe(false);
    expect(isNewer('', '1.7.0')).toBe(false);
  });
});

describe('release links', () => {
  it('prefers the Setup asset of the release', () => {
    const assets = [
      { name: 'SHOSO-Books-Portable-1.8.0.exe', url: 'https://github.com/x/portable.exe' },
      { name: 'SHOSO-Books-Setup-1.8.0.exe', url: 'https://github.com/x/setup.exe' },
    ];
    expect(setupAssetUrl('v1.8.0', assets)).toBe('https://github.com/x/setup.exe');
  });

  it('builds the download URL from the tag when the API gives no assets', () => {
    expect(setupAssetUrl('v1.8.0', []))
      .toBe('https://github.com/i0534145445-bot/SHOSO/releases/download/v1.8.0/SHOSO-Books-Setup-1.8.0.exe');
  });

  it('builds the release page URL', () => {
    expect(releasePageUrl('v1.8.0')).toBe('https://github.com/i0534145445-bot/SHOSO/releases/tag/v1.8.0');
  });
});

describe('update status line', () => {
  it('says something useful in every state', () => {
    expect(updateStatusLine({ status: 'idle' }, '1.7.0')).toBe('גרסה 1.7.0');
    expect(updateStatusLine({ status: 'checking' }, '1.7.0')).toBe('בודק…');
    expect(updateStatusLine({ status: 'available', latest: '1.8.0' }, '1.7.0')).toContain('1.8.0');
    expect(updateStatusLine({ status: 'current' }, '1.7.0')).toContain('מעודכן');
    expect(updateStatusLine({ status: 'offline' }, '1.7.0')).toContain('אין חיבור');
    expect(updateStatusLine({ status: 'unsupported' }, '1.7.0')).toContain('אפליקציה');
  });
});

describe('update state in the store', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
    setState({ updates: { autoCheck: true, status: 'idle', checkedAt: 0, latest: '', page: '', assetUrl: '', notified: '' } });
  });

  it('stays quiet when the machine is offline', async () => {
    globalThis.fetch = () => Promise.reject(new Error('offline'));
    expect(getState().updates.autoCheck).toBe(true);
    const result = await checkForUpdate(false);
    expect(result).toBeNull();
    expect(getState().updates.status).toBe('offline');
    expect(getState().updates.latest).toBe('');
    // nothing cached: the next launch tries again
    expect(getState().updates.checkedAt).toBe(0);
  });

  it('answers HTTP errors the same quiet way', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
    await checkForUpdate(true);
    expect(getState().updates.status).toBe('offline');
  });

  it('offers the newer release with its installer link', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        tag_name: 'v9.9.9',
        html_url: 'https://github.com/i0534145445-bot/SHOSO/releases/tag/v9.9.9',
        assets: [{ name: 'SHOSO-Books-Setup-9.9.9.exe', browser_download_url: 'https://github.com/x/setup.exe', size: 1 }],
      }),
    });
    await checkForUpdate(true);
    const updates = getState().updates;
    expect(updates.status).toBe('available');
    expect(updates.latest).toBe('9.9.9');
    expect(updates.assetUrl).toBe('https://github.com/x/setup.exe');
    expect(updates.checkedAt).toBeGreaterThan(0);
  });

  it('reports that the app is current when GitHub has nothing newer', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ tag_name: 'v0.0.1', html_url: 'https://github.com/i0534145445-bot/SHOSO/releases/tag/v0.0.1', assets: [] }),
    });
    await checkForUpdate(true);
    expect(getState().updates.status).toBe('current');
  });

  it('remembers that automatic checks were switched off', () => {
    setUpdatesOption('autoCheck', false);
    expect(getState().updates.autoCheck).toBe(false);
    setUpdatesOption('autoCheck', true);
  });
});
