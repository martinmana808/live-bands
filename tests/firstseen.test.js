import { describe, it, expect } from 'vitest';
import { applyFirstSeen } from '../fetcher/firstseen.js';

const ev = (over = {}) => ({
  id: 'x', artist: 'X', artistKey: 'x',
  date: '2026-09-20', venue: 'V', venueKey: 'v',
  ticketUrls: [], sources: [], country: null, spotifyId: null,
  ...over,
});

describe('applyFirstSeen', () => {
  const today = '2026-09-05';

  it('stamps today on an event that was not in the previous run', () => {
    const out = applyFirstSeen([ev({ id: 'new' })], [], today);
    expect(out[0].firstSeenAt).toBe(today);
  });

  it('carries forward the original firstSeenAt for an event seen before', () => {
    const prev = [ev({ id: 'known', firstSeenAt: '2026-08-01' })];
    const out = applyFirstSeen([ev({ id: 'known' })], prev, today);
    expect(out[0].firstSeenAt).toBe('2026-08-01');
  });

  it('stamps today on a legacy previous event that has no firstSeenAt', () => {
    const prev = [ev({ id: 'legacy' })];
    const out = applyFirstSeen([ev({ id: 'legacy' })], prev, today);
    expect(out[0].firstSeenAt).toBe(today);
  });

  it('leaves every other field untouched', () => {
    const out = applyFirstSeen([ev({ id: 'a', artist: 'Slowdive' })], [], today);
    expect(out[0].artist).toBe('Slowdive');
    expect(out[0].date).toBe('2026-09-20');
  });
});
