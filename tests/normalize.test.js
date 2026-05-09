import { describe, it, expect } from 'vitest';
import { normalize } from '../fetcher/normalize.js';

describe('normalize', () => {
  it('produces a stable id from artist+date+venue', () => {
    const out = normalize({
      artist: 'Korn',
      date: '2026-05-14',
      venue: 'Movistar Arena',
      ticketUrl: 'https://x',
      source: 'bandsintown',
    });
    expect(out.id).toBe('korn-2026-05-14-movistararena');
  });

  it('lowercases and strips non-alphanumerics for keys', () => {
    const out = normalize({
      artist: 'KoRn!',
      date: '2026-05-14',
      venue: 'C-Art Media',
      source: 'bandsintown',
    });
    expect(out.artistKey).toBe('korn');
    expect(out.venueKey).toBe('cartmedia');
  });

  it('drops common venue words from venueKey', () => {
    const a = normalize({ artist: 'X', date: '2026-01-01', venue: 'Niceto Club', source: 's' });
    const b = normalize({ artist: 'X', date: '2026-01-01', venue: 'Niceto', source: 's' });
    expect(a.venueKey).toBe(b.venueKey);
  });

  it('puts ticketUrl into ticketUrls array (or empty if missing)', () => {
    const a = normalize({ artist: 'X', date: '2026-01-01', venue: 'V', ticketUrl: 'http://t', source: 's' });
    const b = normalize({ artist: 'X', date: '2026-01-01', venue: 'V', source: 's' });
    expect(a.ticketUrls).toEqual(['http://t']);
    expect(b.ticketUrls).toEqual([]);
  });

  it('records the source in sources', () => {
    const out = normalize({ artist: 'X', date: '2026-01-01', venue: 'V', source: 'bandsintown' });
    expect(out.sources).toEqual(['bandsintown']);
  });
});
