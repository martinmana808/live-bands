import { fold } from './search.js';

/**
 * Normalise an artist name to the key used for muting. Matches the artistKey
 * shape produced by normalize.js, so a muted entry can be written either as a
 * key or as a display name.
 *
 * @param {string} name
 */
export function muteKey(name) {
  return fold(name).replace(/ /g, '');
}

/**
 * @param {Array<{artistKey?: string, artist: string}>} events
 * @param {string[]} [muted]
 */
export function filterMuted(events, muted) {
  if (!muted || muted.length === 0) return events;
  const keys = new Set(muted.map(muteKey));
  return events.filter(e => !keys.has(e.artistKey ?? muteKey(e.artist)));
}

/**
 * @param {string[]} [committed]
 * @param {string[]} [local]
 * @returns {string[]}
 */
export function mergeMuted(committed, local) {
  return [...new Set([...(committed ?? []), ...(local ?? [])].map(muteKey))].filter(Boolean);
}
