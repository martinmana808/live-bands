import { describe, it, expect } from 'vitest';
import { resolveAdapterEvents } from '../fetcher/sourcecache.js';

const raw = (n) => Array.from({ length: n }, (_, i) => ({ artist: `A${i}`, date: '2026-09-20', venue: 'V', source: 's' }));

describe('resolveAdapterEvents', () => {
  it('uses a successful fetch and ignores the cache', () => {
    const r = resolveAdapterEvents({ fetched: raw(3), cached: raw(9), previous: { count: 9, lastHealthyAt: '2026-09-05' } });
    expect(r.events).toHaveLength(3);
    expect(r.usedCache).toBe(false);
  });

  it('falls back to the cache when a previously healthy source returns nothing', () => {
    const r = resolveAdapterEvents({ fetched: [], cached: raw(41), previous: { count: 41, lastHealthyAt: '2026-09-05' } });
    expect(r.events).toHaveLength(41);
    expect(r.usedCache).toBe(true);
  });

  it('reports the true fetch count even when falling back, so health stays honest', () => {
    const r = resolveAdapterEvents({ fetched: [], cached: raw(41), previous: { count: 41, lastHealthyAt: '2026-09-05' } });
    expect(r.fetchedCount).toBe(0);
  });

  it('returns nothing when there is no cache to fall back on', () => {
    const r = resolveAdapterEvents({ fetched: [], cached: null, previous: { count: 41, lastHealthyAt: '2026-09-05' } });
    expect(r.events).toEqual([]);
    expect(r.usedCache).toBe(false);
  });

  it('does not fall back for a source that has never worked', () => {
    const r = resolveAdapterEvents({ fetched: [], cached: null, previous: undefined });
    expect(r.events).toEqual([]);
    expect(r.usedCache).toBe(false);
  });

  it('does not resurrect a cache for a source that legitimately has no shows listed', () => {
    const r = resolveAdapterEvents({ fetched: [], cached: raw(5), previous: { count: 0, lastHealthyAt: '2026-08-01' } });
    expect(r.events).toEqual([]);
    expect(r.usedCache).toBe(false);
  });

  it('treats an empty cached array as nothing to fall back on', () => {
    const r = resolveAdapterEvents({ fetched: [], cached: [], previous: { count: 3, lastHealthyAt: '2026-09-05' } });
    expect(r.events).toEqual([]);
    expect(r.usedCache).toBe(false);
  });
});
