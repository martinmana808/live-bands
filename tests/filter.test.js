import { describe, it, expect } from 'vitest';
import { filterInternational, filterTimeWindow } from '../fetcher/filter.js';

const ev = (over = {}) => ({
  id: 'x', artist: 'X', artistKey: 'x',
  date: '2026-05-14', venue: 'V', venueKey: 'v',
  ticketUrls: [], sources: [], country: null, spotifyId: null,
  ...over,
});

describe('filterInternational', () => {
  it('drops AR artists', () => {
    expect(filterInternational([ev({ country: 'AR' })])).toEqual([]);
  });
  it('keeps non-AR artists', () => {
    expect(filterInternational([ev({ country: 'US' })])).toHaveLength(1);
  });
  it('keeps unknown-country artists (long-tail bias)', () => {
    expect(filterInternational([ev({ country: null })])).toHaveLength(1);
  });
});

describe('filterTimeWindow', () => {
  const today = '2026-05-09';
  it('drops events older than 30 days before today', () => {
    expect(filterTimeWindow([ev({ date: '2026-04-08' })], today)).toEqual([]);
  });
  it('keeps events within the past 30 days', () => {
    expect(filterTimeWindow([ev({ date: '2026-04-10' })], today)).toHaveLength(1);
  });
  it('keeps today', () => {
    expect(filterTimeWindow([ev({ date: today })], today)).toHaveLength(1);
  });
  it('keeps future events', () => {
    expect(filterTimeWindow([ev({ date: '2027-01-01' })], today)).toHaveLength(1);
  });
});
