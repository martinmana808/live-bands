/**
 * Stamp each event with the date it was first observed, carrying the value
 * forward from the previous run so "newly added" is meaningful across builds.
 *
 * @param {import('./types.js').EnrichedEvent[]} events
 * @param {Array<{id: string, firstSeenAt?: string}>} prevEvents
 * @param {string} today  - "YYYY-MM-DD"
 */
export function applyFirstSeen(events, prevEvents, today) {
  const seen = new Map();
  for (const p of prevEvents) {
    if (p.firstSeenAt) seen.set(p.id, p.firstSeenAt);
  }
  return events.map(e => ({ ...e, firstSeenAt: seen.get(e.id) ?? today }));
}
