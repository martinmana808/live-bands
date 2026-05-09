/**
 * @param {import('./types.js').EnrichedEvent[]} events
 */
export function filterInternational(events) {
  return events.filter(e => e.country !== 'AR');
}

/**
 * @param {import('./types.js').EnrichedEvent[]} events
 * @param {string} today  - "YYYY-MM-DD"
 */
export function filterTimeWindow(events, today) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return events.filter(e => e.date >= cutoffStr);
}
