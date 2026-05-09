const VENUE_STOPWORDS = new Set(['club', 'teatro', 'estadio', 'bar', 'el', 'la', 'de']);

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
}

function venueSlug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(w => w && !VENUE_STOPWORDS.has(w))
    .join('');
}

/**
 * @param {import('./types.js').RawEvent} raw
 * @returns {import('./types.js').NormalizedEvent}
 */
export function normalize(raw) {
  const artistKey = slug(raw.artist);
  const venueKey = venueSlug(raw.venue);
  return {
    id: `${artistKey}-${raw.date}-${venueKey}`,
    artist: raw.artist,
    artistKey,
    date: raw.date,
    venue: raw.venue,
    venueKey,
    ticketUrls: raw.ticketUrl ? [raw.ticketUrl] : [],
    sources: [raw.source],
  };
}
