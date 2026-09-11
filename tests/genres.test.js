import { describe, it, expect } from 'vitest';
import { genreFamilies, familyCounts, FAMILY_ORDER } from '../fetcher/genres.js';

describe('genreFamilies', () => {
  it('maps metal subgenres to metal', () => {
    expect(genreFamilies(['power metal', 'nwobhm', 'speed metal'])).toEqual(['metal']);
  });

  it('maps electronic subgenres to electronic', () => {
    expect(genreFamilies(['idm', 'ambient techno', 'organic house'])).toEqual(['electronic']);
  });

  it('maps k-pop and dance-pop to pop', () => {
    expect(genreFamilies(['k-pop', 'electropop', 'dance-pop'])).toEqual(['pop']);
  });

  it('lets an artist belong to several families', () => {
    expect(genreFamilies(['pop punk', 'emo'])).toEqual(['punk', 'pop']);
  });

  it('maps acid jazz, funk and disco', () => {
    expect(genreFamilies(['acid jazz', 'funk', 'disco'])).toEqual(['soul', 'jazz']);
  });

  it('maps r&b variants to soul', () => {
    expect(genreFamilies(['alternative r&b', 'contemporary r&b'])).toEqual(['soul']);
  });

  it('maps hip hop, rap and trap', () => {
    expect(genreFamilies(['pop rap', 'trap'])).toEqual(['pop', 'hip-hop']);
  });

  it('maps latin styles', () => {
    expect(genreFamilies(['reggaeton', 'cumbia'])).toEqual(['latin']);
  });

  it('maps rock variants, including indie and shoegaze', () => {
    expect(genreFamilies(['shoegaze', 'indie rock'])).toEqual(['rock']);
  });

  it('does not call alt-rock metal', () => {
    expect(genreFamilies(['alternative rock'])).toEqual(['rock']);
  });

  it('returns nothing for an unknown tag', () => {
    expect(genreFamilies(['sea shanty'])).toEqual([]);
  });

  it('returns nothing for no tags', () => {
    expect(genreFamilies([])).toEqual([]);
    expect(genreFamilies(undefined)).toEqual([]);
  });

  it('returns families in a stable display order', () => {
    expect(genreFamilies(['funk', 'thrash metal', 'garage rock'])).toEqual(['rock', 'metal', 'soul']);
    expect(FAMILY_ORDER.indexOf('rock')).toBeLessThan(FAMILY_ORDER.indexOf('metal'));
  });
});

describe('familyCounts', () => {
  it('counts events per family, in display order, dropping empties', () => {
    const events = [
      { genres: ['heavy metal'] },
      { genres: ['thrash metal'] },
      { genres: ['idm'] },
      { genres: [] },
    ];
    expect(familyCounts(events)).toEqual([['metal', 2], ['electronic', 1]]);
  });
});
