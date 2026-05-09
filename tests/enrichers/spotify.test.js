import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSpotifyEnricher } from '../../fetcher/enrichers/spotify.js';

describe('createSpotifyEnricher', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns null when credentials missing', async () => {
    const enrich = createSpotifyEnricher({ clientId: '', clientSecret: '' });
    expect(await enrich.lookupId('Korn', new Map())).toBe(null);
  });

  it('looks up an artist id and caches it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [{ id: 'sp1' }] } }) });
    vi.stubGlobal('fetch', fetchMock);
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    const cache = new Map();
    expect(await enrich.lookupId('Korn', cache)).toBe('sp1');
    expect(await enrich.lookupId('Korn', cache)).toBe('sp1');
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 token + 1 search; cache hit on 2nd call
  });

  it('returns null when no artist matches', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [] } }) })
    );
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    expect(await enrich.lookupId('Nope', new Map())).toBe(null);
  });

  it('returns null on token failure and does not throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    expect(await enrich.lookupId('Korn', new Map())).toBe(null);
  });
});
