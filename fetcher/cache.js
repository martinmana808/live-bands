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

/**
 * Bump when the Spotify matching logic changes. Only nulls need the stamp: a
 * stored id is real data whoever wrote it, but a null may simply be a run that
 * had no credentials, and freezing that in leaves the artist without artwork
 * forever.
 */
export const SPOTIFY_RESOLVER = 'search-v1';

/**
 * @param {Record<string, import('./types.js').ArtistCacheEntry>} artists
 * @returns {Map<string, {id: string, image: string|null}|null>}
 */
export function buildSpotifyCache(artists) {
  const out = new Map();
  for (const [key, entry] of Object.entries(artists)) {
    if (entry?.spotifyId) {
      out.set(key, { id: entry.spotifyId, image: entry.spotifyImage ?? null });
    } else if (entry?.spotifyResolvedBy === SPOTIFY_RESOLVER) {
      out.set(key, null);
    }
  }
  return out;
}

/**
 * Build the artist cache entry for one artist after a run.
 *
 * The caches only contain a key when the lookup reached a definitive answer,
 * so "absent" means the network let us down, not that the artist is unknown.
 * In that case keep whatever was already known and leave the entry unstamped,
 * which is what makes the next run try again.
 *
 * @param {{
 *   key: string, name: string,
 *   prior?: import('./types.js').ArtistCacheEntry,
 *   countryCache: Map<string, string|null>,
 *   spotifyCache: Map<string, {id: string, image: string|null}|null>,
 *   today: string,
 * }} args
 * @returns {import('./types.js').ArtistCacheEntry}
 */
export function mergeArtistEntry({ key, name, prior, countryCache, spotifyCache, today }) {
  /** @type {any} */
  const entry = { name, lookedUpAt: today };

  if (countryCache.has(key)) {
    entry.country = countryCache.get(key) ?? null;
    entry.countryResolvedBy = COUNTRY_RESOLVER;
  } else {
    entry.country = prior?.country ?? null;
    if (prior?.countryResolvedBy) entry.countryResolvedBy = prior.countryResolvedBy;
  }

  if (spotifyCache.has(key)) {
    const sp = spotifyCache.get(key);
    entry.spotifyId = sp?.id ?? null;
    entry.spotifyImage = sp?.image ?? null;
    entry.spotifyResolvedBy = SPOTIFY_RESOLVER;
  } else {
    entry.spotifyId = prior?.spotifyId ?? null;
    entry.spotifyImage = prior?.spotifyImage ?? null;
    if (prior?.spotifyResolvedBy) entry.spotifyResolvedBy = prior.spotifyResolvedBy;
  }

  return entry;
}
