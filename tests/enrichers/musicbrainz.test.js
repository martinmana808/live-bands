import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupCountry } from '../../fetcher/enrichers/musicbrainz.js';

describe('lookupCountry', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns country from MusicBrainz response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ artists: [{ country: 'US' }] }),
    }));
    const cache = new Map();
    expect(await lookupCountry('Korn', cache)).toBe('US');
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
      ok: true, json: async () => ({ artists: [{ country: 'DE' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const cache = new Map();
    await lookupCountry('Mantar', cache);
    await lookupCountry('Mantar', cache);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
