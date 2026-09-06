import { describe, it, expect } from 'vitest';
import { resolveAdapterEvents, MAX_CACHE_AGE_DAYS } from '../fetcher/sourcecache.js';

const raw = (n) => Array.from({ length: n }, (_, i) => ({ artist: `A${i}`, date: '2026-09-20', venue: 'V', source: 's' }));
const today = '2026-09-06';
const call = (over = {}) => resolveAdapterEvents({ fetched: [], cached: null, cachedAt: null, today, ...over });

describe('resolveAdapterEvents with a working source', () => {
  it('uses the fetch and ignores the cache', () => {
    const r = call({ fetched: raw(3), cached: raw(9), cachedAt: today });
    expect(r.events).toHaveLength(3);
    expect(r.usedCache).toBe(false);
  });
});

describe('resolveAdapterEvents with a blocked source', () => {
  it('falls back to the cache', () => {
    const r = call({ cached: raw(41), cachedAt: '2026-09-05' });
    expect(r.events).toHaveLength(41);
    expect(r.usedCache).toBe(true);
  });

  it('keeps falling back on later runs, not just the first one', () => {
    // Regression: gating this on the previous run's count meant the fallback
    // fired once and then stopped, silently dropping the source's listings.
    const r = call({ cached: raw(41), cachedAt: '2026-09-05', previous: { count: 0, lastHealthyAt: '2026-09-05' } });
    expect(r.events).toHaveLength(41);
    expect(r.usedCache).toBe(true);
  });

  it('reports the true fetch count so health stays honest', () => {
    expect(call({ cached: raw(41), cachedAt: '2026-09-05' }).fetchedCount).toBe(0);
  });

  it('still falls back on the last day of the staleness window', () => {
    const r = call({ cached: raw(41), cachedAt: '2026-08-23' }); // 14 days before today
    expect(r.usedCache).toBe(true);
  });

  it('stops serving a cache that has gone stale', () => {
    const r = call({ cached: raw(41), cachedAt: '2026-08-22' }); // 15 days
    expect(r.events).toEqual([]);
    expect(r.usedCache).toBe(false);
    expect(r.cacheExpired).toBe(true);
  });

  it('uses a two week staleness bound', () => {
    expect(MAX_CACHE_AGE_DAYS).toBe(14);
  });
});

describe('resolveAdapterEvents with nothing to fall back on', () => {
  it('returns nothing when there is no cache', () => {
    const r = call();
    expect(r.events).toEqual([]);
    expect(r.usedCache).toBe(false);
  });

  it('treats an empty cached array as nothing to fall back on', () => {
    expect(call({ cached: [], cachedAt: today }).usedCache).toBe(false);
  });

  it('treats a cache with no recorded date as unusable', () => {
    expect(call({ cached: raw(5), cachedAt: null }).usedCache).toBe(false);
  });
});
