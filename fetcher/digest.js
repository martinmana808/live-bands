/**
 * @param {string} iso  - "YYYY-MM-DD"
 * @param {number} days
 * @returns {string}
 */
function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const byDate = (a, b) => a.date.localeCompare(b.date) || a.artist.localeCompare(b.artist);

/**
 * Split the event list into the two things worth pushing to a phone:
 * what is on in the next fortnight, and what appeared since the last digest.
 *
 * @param {Array<import('./types.js').EnrichedEvent & {firstSeenAt: string}>} events
 * @param {{today: string, days?: number, since?: string, confirmedOnly?: boolean}} opts  - days counts forward from today, inclusive of both ends
 */
export function buildDigest(events, { today, days = 14, since = today, confirmedOnly = true }) {
  const windowEnd = addDays(today, days);

  const inWindow = events.filter(e => e.date >= today && e.date <= windowEnd);

  // An unknown origin is usually a local club night the venue titled badly, not
  // a touring band. Those stay on the site; the message keeps its promise.
  const confirmed = e => !confirmedOnly || Boolean(e.country);

  const fortnight = inWindow.filter(confirmed).sort(byDate);

  const newlyAdded = events
    .filter(e => e.firstSeenAt >= since && e.date >= today)
    .filter(confirmed)
    .sort(byDate);

  return {
    today,
    since,
    windowEnd,
    fortnight,
    newlyAdded,
    unconfirmedInWindow: inWindow.length - inWindow.filter(confirmed).length,
  };
}
