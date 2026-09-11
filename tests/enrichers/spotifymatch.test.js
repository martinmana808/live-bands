import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickSpotifyMatch, createSpotifyEnricher } from '../../fetcher/enrichers/spotify.js';

const item = (over = {}) => ({ id: 'sp1', name: 'Arde la Sangre', images: [], genres: ['argentine rock'], ...over });

describe('pickSpotifyMatch', () => {
  it('accepts an exact name match', () => {
    expect(pickSpotifyMatch([item()], 'Arde la Sangre')).toEqual(item());
  });

  it('ignores case and accents', () => {
    expect(pickSpotifyMatch([item({ name: 'Café Tacvba' })], 'CAFE TACVBA')).toBeTruthy();
  });

  it('rejects the fuzzy hit that turned Arde la Sangre into Cael Umbría', () => {
    expect(pickSpotifyMatch([item({ name: 'Cael Umbría' })], 'ARDE LA SANGRE')).toBeNull();
  });

  it('rejects the fuzzy hit that turned Flema into Flamen Beretta', () => {
    expect(pickSpotifyMatch([item({ name: 'Flamen Beretta' })], 'FLEMA')).toBeNull();
  });

  it('rejects the fuzzy hit that turned Vilma Palma e Vampiros into The Vampire Lestat', () => {
    expect(pickSpotifyMatch([item({ name: 'The Vampire Lestat' })], 'VILMA PALMA e VAMPIRO')).toBeNull();
  });

  it('scans past a wrong first result to a right later one', () => {
    const right = item({ id: 'sp2', name: 'Flema' });
    expect(pickSpotifyMatch([item({ name: 'Flamen Beretta' }), right], 'Flema')).toEqual(right);
  });

  it('ignores a leading "the"', () => {
    expect(pickSpotifyMatch([item({ name: 'The Cure' })], 'Cure')).toBeTruthy();
  });

  it('returns null for an empty list', () => {
    expect(pickSpotifyMatch([], 'Flema')).toBeNull();
  });
});

describe('createSpotifyEnricher returns genres', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('includes the genres Spotify reports', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [item({ genres: ['heavy metal', 'nwobhm'] })] } }) }));
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    const r = await enrich.lookup('Arde la Sangre', new Map());
    expect(r.genres).toEqual(['heavy metal', 'nwobhm']);
  });

  it('gives an empty list when Spotify has no genres', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [item({ genres: undefined })] } }) }));
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    expect((await enrich.lookup('Arde la Sangre', new Map())).genres).toEqual([]);
  });

  it('caches null when the only results are different artists', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [item({ name: 'Cael Umbría' })] } }) }));
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    const cache = new Map();
    expect(await enrich.lookup('Arde la Sangre', cache)).toBeNull();
    expect(cache.get('arde la sangre')).toBeNull();
  });

  it('asks Spotify for several candidates, not just the top one', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [] } }) });
    vi.stubGlobal('fetch', fetchMock);
    await createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' }).lookup('X', new Map());
    expect(fetchMock.mock.calls[1][0]).toMatch(/limit=5/);
  });
});
