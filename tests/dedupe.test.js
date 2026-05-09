import { describe, it, expect } from 'vitest';
import { dedupe } from '../fetcher/dedupe.js';

const norm = (over = {}) => ({
  id: 'x',
  artist: 'X',
  artistKey: 'x',
  date: '2026-05-14',
  venue: 'V',
  venueKey: 'v',
  ticketUrls: [],
  sources: ['a'],
  ...over,
});

describe('dedupe', () => {
  it('keeps distinct events distinct', () => {
    const out = dedupe([
      norm({ artistKey: 'a' }),
      norm({ artistKey: 'b' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('merges events with same artist+date+venue keys', () => {
    const out = dedupe([
      norm({ ticketUrls: ['http://1'], sources: ['bandsintown'] }),
      norm({ ticketUrls: ['http://2'], sources: ['ticketek'] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].ticketUrls.sort()).toEqual(['http://1', 'http://2']);
    expect(out[0].sources.sort()).toEqual(['bandsintown', 'ticketek']);
  });

  it('prefers the longer display name when merging', () => {
    const out = dedupe([
      norm({ artist: 'Korn' }),
      norm({ artist: 'KORN (Live)' }),
    ]);
    expect(out[0].artist).toBe('KORN (Live)');
  });

  it('deduplicates ticket URLs', () => {
    const out = dedupe([
      norm({ ticketUrls: ['http://1'] }),
      norm({ ticketUrls: ['http://1'] }),
    ]);
    expect(out[0].ticketUrls).toEqual(['http://1']);
  });
});
