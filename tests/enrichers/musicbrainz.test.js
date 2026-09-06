import { describe, it, expect, vi, beforeEach } from 'vitest';

// The real 1.1s MusicBrainz throttle is not what these tests are about.
process.env.MUSICBRAINZ_RATE_LIMIT_MS = '0';
const { lookupCountry } = await import('../../fetcher/enrichers/musicbrainz.js');

describe('lookupCountry', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns country from MusicBrainz response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ artists: [{ name: 'Korn', country: 'US', score: 100 }] }),
    }));
    const cache = new Map();
    expect(await lookupCountry('Korn', cache)).toBe('US');
  });

  it('returns null when the only match is a different artist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ artists: [{ name: 'Sham 69', country: 'GB', score: 100 }] }),
    }));
    expect(await lookupCountry('Club 69', new Map())).toBe(null);
  });

  it('returns null when no artists found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ artists: [] }),
    }));
    expect(await lookupCountry('Nope', new Map())).toBe(null);
  });

  it('returns null on HTTP error and does not throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await lookupCountry('Korn', new Map())).toBe(null);
  });

  it('returns null on network error and does not throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')));
    expect(await lookupCountry('Korn', new Map())).toBe(null);
  });

  it('uses cache without calling fetch a second time', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ artists: [{ name: 'Mantar', country: 'DE', score: 100 }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const cache = new Map();
    await lookupCountry('Mantar', cache);
    await lookupCountry('Mantar', cache);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('lookupCountry does not bake in transient failures', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  const hit = { ok: true, json: async () => ({ artists: [{ name: 'Stray Kids', country: 'KR', score: 100 }] }) };

  it('retries within a single lookup after a rate limit response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(hit);
    vi.stubGlobal('fetch', fetchMock);
    expect(await lookupCountry('Stray Kids', new Map())).toBe('KR');
  });

  it('leaves the cache untouched when every attempt fails, so a later run retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const cache = new Map();
    expect(await lookupCountry('Stray Kids', cache)).toBe(null);
    expect(cache.has('stray kids')).toBe(false);
  });

  it('leaves the cache untouched after a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')));
    const cache = new Map();
    await lookupCountry('Korn', cache);
    expect(cache.has('korn')).toBe(false);
  });

  it('does cache a definitive no-match so it is not re-queried', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ artists: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const cache = new Map();
    await lookupCountry('DEEP SESSION #13', cache);
    await lookupCountry('DEEP SESSION #13', cache);
    expect(cache.get('deep session #13')).toBe(null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    await lookupCountry('Korn', new Map());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
