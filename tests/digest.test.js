import { describe, it, expect } from 'vitest';
import { buildDigest } from '../fetcher/digest.js';

const ev = (over = {}) => ({
  id: 'x', artist: 'X', artistKey: 'x',
  date: '2026-09-10', venue: 'V', venueKey: 'v',
  ticketUrls: [], sources: [], country: 'US', spotifyId: null,
  firstSeenAt: '2026-08-01',
  ...over,
});

const today = '2026-09-05';

describe('buildDigest fortnight', () => {
  it('includes an event inside the next 14 days', () => {
    const d = buildDigest([ev({ date: '2026-09-12' })], { today });
    expect(d.fortnight).toHaveLength(1);
  });

  it('includes an event happening today', () => {
    const d = buildDigest([ev({ date: today })], { today });
    expect(d.fortnight).toHaveLength(1);
  });

  it('includes the last day of the window', () => {
    const d = buildDigest([ev({ date: '2026-09-19' })], { today });
    expect(d.fortnight).toHaveLength(1);
  });

  it('excludes an event past the window', () => {
    const d = buildDigest([ev({ date: '2026-09-20' })], { today });
    expect(d.fortnight).toEqual([]);
  });

  it('excludes an event that already happened', () => {
    const d = buildDigest([ev({ date: '2026-09-04' })], { today });
    expect(d.fortnight).toEqual([]);
  });

  it('sorts by date ascending', () => {
    const d = buildDigest([
      ev({ id: 'b', date: '2026-09-15' }),
      ev({ id: 'a', date: '2026-09-07' }),
    ], { today });
    expect(d.fortnight.map(e => e.id)).toEqual(['a', 'b']);
  });

  it('honours a custom window length', () => {
    const d = buildDigest([ev({ date: '2026-09-25' })], { today, days: 30 });
    expect(d.fortnight).toHaveLength(1);
  });
});

describe('buildDigest newlyAdded', () => {
  it('includes an event first seen today', () => {
    const d = buildDigest([ev({ firstSeenAt: today, date: '2026-11-01' })], { today });
    expect(d.newlyAdded).toHaveLength(1);
  });

  it('excludes an event seen on an earlier run', () => {
    const d = buildDigest([ev({ firstSeenAt: '2026-09-04' })], { today });
    expect(d.newlyAdded).toEqual([]);
  });

  it('includes anything first seen on or after an explicit since date', () => {
    const d = buildDigest([ev({ firstSeenAt: '2026-09-03' })], { today, since: '2026-09-01' });
    expect(d.newlyAdded).toHaveLength(1);
  });

  it('excludes a newly scraped event whose date has already passed', () => {
    const d = buildDigest([ev({ firstSeenAt: today, date: '2026-08-30' })], { today });
    expect(d.newlyAdded).toEqual([]);
  });

  it('announces newly added shows far beyond the fortnight window', () => {
    const d = buildDigest([ev({ firstSeenAt: today, date: '2026-12-18' })], { today });
    expect(d.newlyAdded).toHaveLength(1);
    expect(d.fortnight).toEqual([]);
  });

  it('sorts by date ascending', () => {
    const d = buildDigest([
      ev({ id: 'b', firstSeenAt: today, date: '2026-12-01' }),
      ev({ id: 'a', firstSeenAt: today, date: '2026-10-01' }),
    ], { today });
    expect(d.newlyAdded.map(e => e.id)).toEqual(['a', 'b']);
  });
});

describe('buildDigest metadata', () => {
  it('reports the window it used', () => {
    const d = buildDigest([], { today });
    expect(d.today).toBe(today);
    expect(d.windowEnd).toBe('2026-09-19');
    expect(d.since).toBe(today);
  });
});

describe('buildDigest only reports confirmed international acts', () => {
  it('excludes an unknown-origin show from the fortnight', () => {
    const d = buildDigest([ev({ country: null, date: '2026-09-12' })], { today });
    expect(d.fortnight).toEqual([]);
  });

  it('excludes an unknown-origin show from newly added', () => {
    const d = buildDigest([ev({ country: null, firstSeenAt: today })], { today });
    expect(d.newlyAdded).toEqual([]);
  });

  it('keeps a confirmed international show', () => {
    const d = buildDigest([ev({ country: 'KR', date: '2026-09-12' })], { today });
    expect(d.fortnight).toHaveLength(1);
  });

  it('counts what it left out so the message can point at the site', () => {
    const d = buildDigest([
      ev({ id: 'a', country: null, date: '2026-09-12' }),
      ev({ id: 'b', country: null, date: '2026-09-13' }),
      ev({ id: 'c', country: 'GB', date: '2026-09-14' }),
    ], { today });
    expect(d.unconfirmedInWindow).toBe(2);
  });

  it('can be told to include unconfirmed shows', () => {
    const d = buildDigest([ev({ country: null, date: '2026-09-12' })], { today, confirmedOnly: false });
    expect(d.fortnight).toHaveLength(1);
  });
});
