import { describe, it, expect } from 'vitest';
import { mergeArtistEntry, COUNTRY_RESOLVER, SPOTIFY_RESOLVER } from '../fetcher/cache.js';

const today = '2026-09-06';
const call = (over = {}) => mergeArtistEntry({
  key: 'korn', name: 'Korn', prior: undefined,
  countryCache: new Map(), spotifyCache: new Map(), today,
  ...over,
});

describe('mergeArtistEntry with a definitive answer', () => {
  it('stores a resolved country and stamps it', () => {
    const e = call({ countryCache: new Map([['korn', { country: 'US', genres: [] }]]) });
    expect(e.country).toBe('US');
    expect(e.countryResolvedBy).toBe(COUNTRY_RESOLVER);
  });

  it('stamps a confirmed unknown country so it is not re-queried', () => {
    const e = call({ countryCache: new Map([['korn', { country: null, genres: [] }]]) });
    expect(e.country).toBeNull();
    expect(e.countryResolvedBy).toBe(COUNTRY_RESOLVER);
  });

  it('stores a resolved spotify id and stamps it', () => {
    const e = call({ spotifyCache: new Map([['korn', { id: 'sp1', image: 'https://i/x.jpg' }]]) });
    expect(e.spotifyId).toBe('sp1');
    expect(e.spotifyImage).toBe('https://i/x.jpg');
    expect(e.spotifyResolvedBy).toBe(SPOTIFY_RESOLVER);
  });
});

describe('mergeArtistEntry when the lookup was inconclusive', () => {
  it('does not stamp a country it never actually resolved', () => {
    const e = call();
    expect(e.country).toBeNull();
    expect(e.countryResolvedBy).toBeUndefined();
  });

  it('does not stamp a spotify id it never actually resolved', () => {
    const e = call();
    expect(e.spotifyId).toBeNull();
    expect(e.spotifyResolvedBy).toBeUndefined();
  });

  it('keeps a previously resolved country rather than blanking it', () => {
    const prior = { name: 'Korn', country: 'US', countryResolvedBy: COUNTRY_RESOLVER, spotifyId: null, spotifyImage: null, lookedUpAt: '2026-09-01' };
    const e = call({ prior });
    expect(e.country).toBe('US');
    expect(e.countryResolvedBy).toBe(COUNTRY_RESOLVER);
  });

  it('keeps a previously resolved spotify id and image', () => {
    const prior = { name: 'Korn', country: null, spotifyId: 'sp1', spotifyImage: 'https://i/x.jpg', spotifyResolvedBy: SPOTIFY_RESOLVER, lookedUpAt: '2026-09-01' };
    const e = call({ prior });
    expect(e.spotifyId).toBe('sp1');
    expect(e.spotifyImage).toBe('https://i/x.jpg');
  });

  it('lets a fresh answer overwrite a stale prior one', () => {
    const prior = { name: 'Korn', country: 'GB', countryResolvedBy: 'mb-old', spotifyId: null, spotifyImage: null, lookedUpAt: '2026-09-01' };
    const e = call({ prior, countryCache: new Map([['korn', { country: 'US', genres: [] }]]) });
    expect(e.country).toBe('US');
    expect(e.countryResolvedBy).toBe(COUNTRY_RESOLVER);
  });

  it('always records the display name and the run date', () => {
    const e = call();
    expect(e.name).toBe('Korn');
    expect(e.lookedUpAt).toBe(today);
  });
});

describe('mergeArtistEntry genres', () => {
  it('stores genres from a resolved spotify lookup', () => {
    const e = call({ spotifyCache: new Map([['korn', { id: 'sp1', image: null, genres: ['nu metal'] }]]) });
    expect(e.spotifyGenres).toEqual(['nu metal']);
  });

  it('keeps prior genres when the lookup was inconclusive', () => {
    const prior = { name: 'Korn', country: null, spotifyId: 'sp1', spotifyImage: null, spotifyGenres: ['nu metal'], lookedUpAt: '2026-09-01' };
    expect(call({ prior }).spotifyGenres).toEqual(['nu metal']);
  });

  it('writes an empty list rather than nothing when unknown', () => {
    expect(call().spotifyGenres).toEqual([]);
  });
});

describe('mergeArtistEntry origin genres', () => {
  it('stores genres alongside a resolved country', () => {
    const e = call({ countryCache: new Map([['korn', { country: 'US', genres: ['nu metal'] }]]) });
    expect(e.country).toBe('US');
    expect(e.genres).toEqual(['nu metal']);
    expect(e.countryResolvedBy).toBe(COUNTRY_RESOLVER);
  });

  it('keeps prior genres when the lookup was inconclusive', () => {
    const prior = { name: 'Korn', country: 'US', genres: ['nu metal'], countryResolvedBy: COUNTRY_RESOLVER, spotifyId: null, spotifyImage: null, lookedUpAt: '2026-09-01' };
    expect(call({ prior }).genres).toEqual(['nu metal']);
  });
});
