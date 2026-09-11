import { createHash } from 'node:crypto';
import { cleanArtistName } from './artistname.js';

/**
 * A short opaque code for share links. Derived from the stable id rather than
 * random, so the same show gets the same code on every rebuild and a link
 * shared today still resolves next month.
 */
function shortId(id) {
  return createHash('sha1').update(id).digest('hex').slice(0, 12)
    .split('').reduce((n, c) => n * 16n + BigInt(parseInt(c, 16)), 0n)
    .toString(36).padStart(7, '0').slice(0, 7);
}

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
  const artist = cleanArtistName(raw.artist);
  const artistKey = slug(artist);
  const venueKey = venueSlug(raw.venue);
  const id = `${artistKey}-${raw.date}-${venueKey}`;
  return {
    id,
    shortId: shortId(id),
    artist,
    artistKey,
    date: raw.date,
    venue: raw.venue,
    venueKey,
    ticketUrls: raw.ticketUrl ? [raw.ticketUrl] : [],
    sources: [raw.source],
  };
}
