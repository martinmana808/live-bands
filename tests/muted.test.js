import { describe, it, expect } from 'vitest';
import { muteKey, filterMuted, mergeMuted } from '../fetcher/muted.js';

const ev = (over = {}) => ({ artist: 'Ozuna', artistKey: 'ozuna', date: '2026-09-20', ...over });

describe('muteKey', () => {
  it('uses the same slug shape as the event artistKey', () => {
    expect(muteKey('Ozuna')).toBe('ozuna');
  });

  it('ignores case, spacing and accents', () => {
    expect(muteKey('Café  TACVBA')).toBe('cafetacvba');
  });

  it('handles an empty name', () => {
    expect(muteKey('')).toBe('');
  });
});

describe('filterMuted', () => {
  it('drops an event whose artist is muted', () => {
    expect(filterMuted([ev()], ['ozuna'])).toEqual([]);
  });

  it('keeps an event that is not muted', () => {
    expect(filterMuted([ev()], ['slowdive'])).toHaveLength(1);
  });

  it('matches a muted entry written as a display name', () => {
    expect(filterMuted([ev()], ['Ozuna'])).toEqual([]);
  });

  it('keeps everything when nothing is muted', () => {
    expect(filterMuted([ev()], [])).toHaveLength(1);
  });

  it('tolerates a missing mute list', () => {
    expect(filterMuted([ev()], undefined)).toHaveLength(1);
  });
});

describe('mergeMuted', () => {
  it('combines the committed list with the browser one', () => {
    expect(mergeMuted(['ozuna'], ['slowdive']).sort()).toEqual(['ozuna', 'slowdive']);
  });

  it('deduplicates across the two sources', () => {
    expect(mergeMuted(['Ozuna'], ['ozuna'])).toEqual(['ozuna']);
  });

  it('tolerates either side being missing', () => {
    expect(mergeMuted(undefined, ['ozuna'])).toEqual(['ozuna']);
    expect(mergeMuted(['ozuna'], undefined)).toEqual(['ozuna']);
  });
});
