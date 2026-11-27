import { describe, it, expect, beforeAll } from 'vitest';
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
  it('defaults to automatic checks and stays quiet when there is no network', async () => {
    setState({ updates: { autoCheck: true, status: 'idle', checkedAt: 0, latest: '', page: '', assetUrl: '', notified: '' } });
    expect(getState().updates.autoCheck).toBe(true);
    // jsdom has no route to GitHub: the check must not throw, and the app
    // must simply stay on the version it has.
    const result = await checkForUpdate(false);
    expect(result).toBeNull();
    expect(['offline', 'unsupported']).toContain(getState().updates.status);
    expect(getState().updates.latest).toBe('');
  });

  it('remembers that automatic checks were switched off', () => {
    setUpdatesOption('autoCheck', false);
    expect(getState().updates.autoCheck).toBe(false);
    setUpdatesOption('autoCheck', true);
  });
});
