import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSpotifyEnricher } from '../../fetcher/enrichers/spotify.js';

describe('createSpotifyEnricher', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns null when credentials missing', async () => {
    const enrich = createSpotifyEnricher({ clientId: '', clientSecret: '' });
    expect(await enrich.lookup('Korn', new Map())).toBe(null);
  });

  it('looks up artist id and image, caches the result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        artists: { items: [{
          id: 'sp1',
          images: [
            { url: 'https://i.scdn.co/640.jpg', width: 640, height: 640 },
            { url: 'https://i.scdn.co/320.jpg', width: 320, height: 320 },
            { url: 'https://i.scdn.co/64.jpg',  width: 64,  height: 64 },
          ],
        }]}
      })});
    vi.stubGlobal('fetch', fetchMock);
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    const cache = new Map();
    const first = await enrich.lookup('Korn', cache);
    expect(first).toEqual({ id: 'sp1', image: 'https://i.scdn.co/64.jpg' });
    const second = await enrich.lookup('Korn', cache);
    expect(second).toEqual({ id: 'sp1', image: 'https://i.scdn.co/64.jpg' });
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 token + 1 search; 2nd lookup hits cache
  });

  it('returns image=null when artist has no images', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [{ id: 'sp1', images: [] }] } }) })
    );
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    expect(await enrich.lookup('NoPics', new Map())).toEqual({ id: 'sp1', image: null });
  });

  it('picks the smallest image when multiple sizes are returned', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        artists: { items: [{
          id: 'sp1',
          images: [
            { url: 'big',    width: 800 },
            { url: 'medium', width: 200 },
            { url: 'tiny',   width: 50  },
            { url: 'small',  width: 100 },
          ],
        }]}
      })})
    );
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    const r = await enrich.lookup('X', new Map());
    expect(r.image).toBe('tiny');
  });

  it('returns null when no artist matches', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [] } }) })
    );
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    expect(await enrich.lookup('Nope', new Map())).toBe(null);
  });

  it('returns null on token failure and does not throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'bad' }));
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    expect(await enrich.lookup('Korn', new Map())).toBe(null);
  });
});
