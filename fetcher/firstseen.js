/**
 * How long an id is remembered after it was first seen. Shows are announced up
 * to a year ahead, so the ledger has to outlive the listing itself.
 */
export const LEDGER_TTL_DAYS = 450;

function ageInDays(fromIso, toIso) {
  return (Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000;
}

/**
 * Stamp each event with the date it was first observed.
 *
 * The ledger is kept separately from the event list on purpose. Deriving this
 * from the previous events.json means a source outage erases the history: when
 * a blocked scraper dropped 37 Vorterix shows for a single run, every one of
 * them came back the next day looking brand new. The ledger remembers an id
 * even while it is missing from the site.
 *
 * @param {import('./types.js').EnrichedEvent[]} events
 * @param {Record<string, string>} ledger  - event id -> ISO date first seen
 * @param {string} today
 * @returns {{events: Array<import('./types.js').EnrichedEvent & {firstSeenAt: string}>, ledger: Record<string, string>}}
 */
export function applyFirstSeen(events, ledger, today) {
  /** @type {Record<string, string>} */
  const next = {};
  for (const [id, seenAt] of Object.entries(ledger)) {
    if (ageInDays(seenAt, today) <= LEDGER_TTL_DAYS) next[id] = seenAt;
  }

  const stamped = events.map(e => {
    const firstSeenAt = next[e.id] ?? today;
    next[e.id] = firstSeenAt;
    return { ...e, firstSeenAt };
  });

  return { events: stamped, ledger: next };
}

/**
 * Build a ledger from events that already carry firstSeenAt, for migrating
 * from the old in-file representation.
 *
 * @param {Array<{id: string, firstSeenAt?: string}>} events
 * @returns {Record<string, string>}
 */
export function seedLedger(events) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const e of events) {
    if (!e.firstSeenAt) continue;
    if (!out[e.id] || e.firstSeenAt < out[e.id]) out[e.id] = e.firstSeenAt;
  }
  return out;
}
