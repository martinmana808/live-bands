/**
 * Decide what a single adapter contributes to this run.
 *
 * Scrapers get blocked — allaccess.com.ar and nicetoclub.com both refuse the
 * GitHub runner's datacenter IP while answering a home connection fine. When
 * that happens the right move is to keep serving that venue's last known
 * listings (they age out of the time window on their own) rather than drop
 * 40% of the site for the day. The alarm still fires; the readers still see
 * the shows.
 *
 * @param {{fetched: any[], cached: any[]|null, previous?: {count: number, lastHealthyAt: string|null}}} args
 * @returns {{events: any[], usedCache: boolean, fetchedCount: number}}
 */
export function resolveAdapterEvents({ fetched, cached, previous }) {
  const fetchedCount = fetched.length;
  if (fetchedCount > 0) return { events: fetched, usedCache: false, fetchedCount };

  const wasHealthy = (previous?.count ?? 0) > 0;
  const hasCache = Array.isArray(cached) && cached.length > 0;
  if (wasHealthy && hasCache) return { events: cached, usedCache: true, fetchedCount };

  return { events: [], usedCache: false, fetchedCount };
}
