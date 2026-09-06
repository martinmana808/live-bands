import { describe, it, expect } from 'vitest';
import { pickMatch } from '../../fetcher/enrichers/musicbrainz.js';

const mb = (over = {}) => ({ name: 'Air Supply', country: 'AU', score: 100, ...over });

describe('pickMatch', () => {
  it('accepts a high-scoring exact name match', () => {
    expect(pickMatch([mb()], 'Air Supply')).toEqual(mb());
  });

  it('ignores case and accents', () => {
    const hit = mb({ name: 'Poseidótica', country: 'AR' });
    expect(pickMatch([hit], 'Poseidotica')).toEqual(hit);
  });

  it('ignores a leading "the"', () => {
    const hit = mb({ name: 'The Cure', country: 'GB' });
    expect(pickMatch([hit], 'Cure')).toEqual(hit);
  });

  it('ignores punctuation differences', () => {
    const hit = mb({ name: 'Godspeed You! Black Emperor', country: 'CA' });
    expect(pickMatch([hit], 'Godspeed You Black Emperor')).toEqual(hit);
  });

  it('rejects the fuzzy match that turns Club 69 into Sham 69', () => {
    expect(pickMatch([mb({ name: 'Sham 69', country: 'GB' })], 'Club 69')).toBeNull();
  });

  it('rejects the fuzzy match that turns Los Sub into Sub Sub', () => {
    expect(pickMatch([mb({ name: 'Sub Sub', country: 'GB' })], 'Los Sub')).toBeNull();
  });

  it('rejects an exact name that scored poorly', () => {
    expect(pickMatch([mb({ score: 60 })], 'Air Supply')).toBeNull();
  });

  it('accepts a match on a registered alias', () => {
    const hit = mb({ name: 'Die Ärzte', country: 'DE', aliases: [{ name: 'Die Aerzte' }] });
    expect(pickMatch([hit], 'Die Aerzte')).toEqual(hit);
  });

  it('scans past a bad first result to a real one', () => {
    const good = mb({ name: 'Slowdive', country: 'GB' });
    expect(pickMatch([mb({ name: 'Slowdive Tribute', score: 95 }), good], 'Slowdive')).toEqual(good);
  });

  it('returns null for an empty result list', () => {
    expect(pickMatch([], 'Air Supply')).toBeNull();
  });

  it('returns null when given nothing', () => {
    expect(pickMatch(undefined, 'Air Supply')).toBeNull();
  });
});
