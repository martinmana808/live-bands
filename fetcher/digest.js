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

import { filterMuted } from './muted.js';

const byDate = (a, b) => a.date.localeCompare(b.date) || a.artist.localeCompare(b.artist);

/**
 * Split the event list into the two things worth pushing to a phone:
 * what is on in the next fortnight, and what appeared since the last digest.
 *
 * @param {Array<import('./types.js').EnrichedEvent & {firstSeenAt: string}>} events
 * @param {{today: string, days?: number, since?: string, confirmedOnly?: boolean, muted?: string[]}} opts  - days counts forward from today, inclusive of both ends
 */
export function buildDigest(events, { today, days = 14, since = today, confirmedOnly = true, muted }) {
  const windowEnd = addDays(today, days);
  events = filterMuted(events, muted);

  const inWindow = events.filter(e => e.date >= today && e.date <= windowEnd);

  // The site lists everything; the message is about touring acts. An unknown
  // origin is usually a local club night the venue titled badly, and a
  // confirmed Argentine act is local by definition. Both stay on the site.
  const confirmed = e => !confirmedOnly || (Boolean(e.country) && e.country !== 'AR');

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
    // Unknown origin, not merely excluded: a confirmed Argentine act is local, not a mystery.
    unconfirmedInWindow: confirmedOnly ? inWindow.filter(e => !e.country).length : 0,
  };
}
