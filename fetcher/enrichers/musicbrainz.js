const UA = 'BandsInTown/0.1 (https://github.com/martinmana808/bands-in-town)';

/**
 * @param {string} artistName
 * @param {Map<string, string|null>} cache  keyed by lowercase artist name
 * @returns {Promise<string|null>}  ISO country code or null
 */
export async function lookupCountry(artistName, cache) {
  const key = artistName.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent('artist:' + artistName)}&fmt=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json();
    const country = data?.artists?.[0]?.country ?? null;
    cache.set(key, country);
    return country;
  } catch {
    cache.set(key, null);
    return null;
  }
}
