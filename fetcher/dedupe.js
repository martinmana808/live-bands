/**
 * @param {import('./types.js').NormalizedEvent[]} events
 * @returns {import('./types.js').NormalizedEvent[]}
 */
export function dedupe(events) {
  /** @type {Map<string, import('./types.js').NormalizedEvent>} */
  const map = new Map();
  for (const e of events) {
    const key = `${e.artistKey}|${e.date}|${e.venueKey}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...e });
      continue;
    }
    map.set(key, {
      ...prev,
      artist: prev.artist.length >= e.artist.length ? prev.artist : e.artist,
      venue: prev.venue.length >= e.venue.length ? prev.venue : e.venue,
      ticketUrls: [...new Set([...prev.ticketUrls, ...e.ticketUrls])],
      sources: [...new Set([...prev.sources, ...e.sources])],
    });
  }
  return [...map.values()];
}
