/**
 * Fold text for comparison: lowercase, strip accents and punctuation. Searching
 * "cafe" has to find "Café Tacvba", and searching "café" has to find a source
 * that spelled it without the accent.
 *
 * @param {string} s
 */
export function fold(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Every word in the query must appear somewhere in the event.
 *
 * @param {{artist: string, venue: string, country?: string|null}} event
 * @param {string} query
 */
export function matchesQuery(event, query) {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(`${event.artist} ${event.venue} ${event.country ?? ''}`);
  return words.every(w => haystack.includes(w));
}
