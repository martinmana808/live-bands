/** How long a blocked source keeps serving its last successful fetch. */
export const MAX_CACHE_AGE_DAYS = 14;

function ageInDays(fromIso, toIso) {
  return (Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000;
}

/**
 * Decide what a single adapter contributes to this run.
 *
 * Scrapers get blocked — allaccess.com.ar (Vorterix) 403s the GitHub runner
 * and nicetoclub.com intermittently serves it an empty page, while both answer
 * a home connection fine. Dropping that venue's listings for the day is worse
 * than showing yesterday's, so a source that returns nothing falls back to its
 * last successful fetch.
 *
 * The fallback is bounded by age, not by how long the source has been down:
 * gating it on the previous run's count made it fire once and then stop, which
 * is the opposite of what an outage needs. Past MAX_CACHE_AGE_DAYS the source
 * goes dark rather than showing listings nobody has re-confirmed in a fortnight.
 *
 * @param {{fetched: any[], cached: any[]|null, cachedAt: string|null, today: string}} args
 * @returns {{events: any[], usedCache: boolean, fetchedCount: number, cacheExpired: boolean}}
 */
export function resolveAdapterEvents({ fetched, cached, cachedAt, today }) {
  const fetchedCount = fetched.length;
  const base = { fetchedCount, cacheExpired: false };

  if (fetchedCount > 0) return { ...base, events: fetched, usedCache: false };

  const hasCache = Array.isArray(cached) && cached.length > 0 && Boolean(cachedAt);
  if (!hasCache) return { ...base, events: [], usedCache: false };

  if (ageInDays(cachedAt, today) > MAX_CACHE_AGE_DAYS) {
    return { ...base, events: [], usedCache: false, cacheExpired: true };
  }

  return { ...base, events: cached, usedCache: true };
}
