import { describe, it, expect } from 'vitest';
import { buildCountryCache, COUNTRY_RESOLVER } from '../fetcher/cache.js';

const entry = (over = {}) => ({ name: 'Korn', country: 'US', spotifyId: null, spotifyImage: null, lookedUpAt: '2026-09-01', ...over });

describe('buildCountryCache', () => {
  it('trusts an entry resolved by the current resolver', () => {
    const c = buildCountryCache({ korn: entry({ countryResolvedBy: COUNTRY_RESOLVER }) });
    expect(c.get('korn')).toBe('US');
  });

  it('keeps a confirmed null so a known-unknown artist is not re-queried', () => {
    const c = buildCountryCache({ korn: entry({ country: null, countryResolvedBy: COUNTRY_RESOLVER }) });
    expect(c.has('korn')).toBe(true);
    expect(c.get('korn')).toBeNull();
  });

  it('drops an entry written by an older resolver so it gets looked up again', () => {
    const c = buildCountryCache({ korn: entry() });
    expect(c.has('korn')).toBe(false);
  });

  it('drops an entry stamped by a different resolver version', () => {
    const c = buildCountryCache({ korn: entry({ countryResolvedBy: 'mb-v0' }) });
    expect(c.has('korn')).toBe(false);
  });

  it('handles an empty record', () => {
    expect(buildCountryCache({}).size).toBe(0);
  });
});
