/**
 * Bump this whenever the country-resolution logic changes. Cached countries
 * written by an older resolver are ignored and looked up again, so a bad
 * match does not survive forever in data/artists.json.
 */
export const COUNTRY_RESOLVER = 'mb-exact-v2';

/**
 * @param {Record<string, import('./types.js').ArtistCacheEntry>} artists
 * @returns {Map<string, string|null>}
 */
export function buildCountryCache(artists) {
  const out = new Map();
  for (const [key, entry] of Object.entries(artists)) {
    if (entry?.countryResolvedBy !== COUNTRY_RESOLVER) continue;
    out.set(key, entry.country ?? null);
  }
  return out;
}
