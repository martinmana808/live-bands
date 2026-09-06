import { describe, it, expect } from 'vitest';
import { checkAdapterHealth, updateHealth } from '../fetcher/health.js';

describe('checkAdapterHealth', () => {
  it('flags an adapter that produced events yesterday and none today', () => {
    const prev = { vorterix: { count: 44, lastHealthyAt: '2026-09-04' } };
    const { regressions } = checkAdapterHealth(prev, { vorterix: 0 });
    expect(regressions).toEqual([{ name: 'vorterix', previous: 44, lastHealthyAt: '2026-09-04' }]);
  });

  it('does not flag a healthy adapter', () => {
    const prev = { songkick: { count: 48, lastHealthyAt: '2026-09-04' } };
    const { regressions } = checkAdapterHealth(prev, { songkick: 48 });
    expect(regressions).toEqual([]);
  });

  it('does not flag a brand new adapter that returned nothing', () => {
    const { regressions } = checkAdapterHealth({}, { newsource: 0 });
    expect(regressions).toEqual([]);
  });

  it('reports an already-broken adapter as down rather than a fresh regression', () => {
    const prev = { vorterix: { count: 0, lastHealthyAt: '2026-08-20' } };
    const { regressions, down } = checkAdapterHealth(prev, { vorterix: 0 });
    expect(regressions).toEqual([]);
    expect(down).toEqual([{ name: 'vorterix', lastHealthyAt: '2026-08-20' }]);
  });

  it('treats a recovered adapter as neither down nor regressed', () => {
    const prev = { vorterix: { count: 0, lastHealthyAt: '2026-08-20' } };
    const { regressions, down } = checkAdapterHealth(prev, { vorterix: 44 });
    expect(regressions).toEqual([]);
    expect(down).toEqual([]);
  });
});

describe('updateHealth', () => {
  const today = '2026-09-05';

  it('records lastHealthyAt when an adapter returns events', () => {
    const out = updateHealth({}, { songkick: 48 }, today);
    expect(out.songkick).toEqual({ count: 48, lastHealthyAt: today });
  });

  it('keeps the previous lastHealthyAt when an adapter returns nothing', () => {
    const prev = { vorterix: { count: 44, lastHealthyAt: '2026-09-04' } };
    const out = updateHealth(prev, { vorterix: 0 }, today);
    expect(out.vorterix).toEqual({ count: 0, lastHealthyAt: '2026-09-04' });
  });

  it('leaves lastHealthyAt null for an adapter that has never worked', () => {
    const out = updateHealth({}, { broken: 0 }, today);
    expect(out.broken).toEqual({ count: 0, lastHealthyAt: null });
  });
});
