import { describe, it, expect } from 'vitest';
import { filterTimeWindow } from '../fetcher/filter.js';

const ev = (over = {}) => ({
  id: 'x', artist: 'X', artistKey: 'x',
  date: '2026-05-14', venue: 'V', venueKey: 'v',
  ticketUrls: [], sources: [], country: null, spotifyId: null,
  ...over,
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
