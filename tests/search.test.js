import { describe, it, expect } from 'vitest';
import { matchesQuery } from '../fetcher/search.js';

const ev = (over = {}) => ({ artist: 'Café Tacvba', venue: 'Niceto Club', country: 'MX', ...over });

describe('matchesQuery', () => {
  it('matches everything when the query is empty', () => {
    expect(matchesQuery(ev(), '')).toBe(true);
    expect(matchesQuery(ev(), '   ')).toBe(true);
  });

  it('matches on part of the artist name', () => {
    expect(matchesQuery(ev(), 'tacv')).toBe(true);
  });

  it('matches on the venue', () => {
    expect(matchesQuery(ev(), 'niceto')).toBe(true);
  });

  it('ignores case', () => {
    expect(matchesQuery(ev(), 'CAFE')).toBe(true);
  });

  it('ignores accents in the query and the data', () => {
    expect(matchesQuery(ev(), 'cafe')).toBe(true);
    expect(matchesQuery(ev({ artist: 'Cafe Tacvba' }), 'café')).toBe(true);
  });

  it('requires every word to match somewhere', () => {
    expect(matchesQuery(ev(), 'tacvba niceto')).toBe(true);
    expect(matchesQuery(ev(), 'tacvba movistar')).toBe(false);
  });

  it('does not match an unrelated query', () => {
    expect(matchesQuery(ev(), 'slowdive')).toBe(false);
  });

  it('matches on country code so you can search by origin', () => {
    expect(matchesQuery(ev(), 'mx')).toBe(true);
  });

  it('tolerates a missing country', () => {
    expect(matchesQuery(ev({ country: null }), 'tacvba')).toBe(true);
  });

  it('ignores punctuation in the query', () => {
    expect(matchesQuery(ev({ artist: 'Godspeed You! Black Emperor' }), 'godspeed you black')).toBe(true);
  });
});
