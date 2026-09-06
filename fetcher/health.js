/**
 * @typedef {Object} AdapterHealth
 * @property {number} count            - events returned on the last run
 * @property {string|null} lastHealthyAt - last date the adapter returned anything
 */

/**
 * Compare this run's per-adapter counts against the last recorded run.
 *
 * A source that worked yesterday and returns nothing today is a regression and
 * should stop the build; one that was already broken is reported as down so it
 * stays visible without blocking every subsequent rebuild.
 *
 * @param {Record<string, AdapterHealth>} previous
 * @param {Record<string, number>} counts
 */
export function checkAdapterHealth(previous, counts) {
  const regressions = [];
  const down = [];
  for (const [name, count] of Object.entries(counts)) {
    if (count > 0) continue;
    const prev = previous[name];
    if (!prev) continue;
    if (prev.count > 0) {
      regressions.push({ name, previous: prev.count, lastHealthyAt: prev.lastHealthyAt });
    } else {
      down.push({ name, lastHealthyAt: prev.lastHealthyAt });
    }
  }
  return { regressions, down };
}

/**
 * @param {Record<string, AdapterHealth>} previous
 * @param {Record<string, number>} counts
 * @param {string} today
 * @returns {Record<string, AdapterHealth>}
 */
export function updateHealth(previous, counts, today) {
  /** @type {Record<string, AdapterHealth>} */
  const out = {};
  for (const [name, count] of Object.entries(counts)) {
    out[name] = {
      count,
      lastHealthyAt: count > 0 ? today : (previous[name]?.lastHealthyAt ?? null),
    };
  }
  return out;
}
