import * as cheerio from 'cheerio';
import { fetchHtml } from '../http.js';
import { parseSpanishDate } from '../dates.js';

// Livepass is DF Entertainment's ticketing platform: stadium and arena shows
// (Iron Maiden, Ed Sheeran) that the venue calendars never carry.
const URL = 'https://livepass.com.ar/';
const ORIGIN = 'https://livepass.com.ar';

// A two-night run is listed once as "20 OCT al 21 OCT". Emit both nights, but
// a month-long theatre season is not two hundred concerts, so cap the spread.
const MAX_RANGE_DAYS = 3;

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000;
}

function splitTitle(title) {
  const m = title.match(/^(.+?)\s+en\s+(.+)$/i);
  return { artist: m ? m[1].trim() : title, venue: m ? m[2].trim() : 'Livepass' };
}

function absolute(href) {
  return href ? (href.startsWith('http') ? href : ORIGIN + href) : undefined;
}

/**
 * Big shows are listed before they go on sale with the date left blank on the
 * card. The event page carries it in structured data, with the announcement
 * copy as a fallback.
 *
 * @param {string} html
 * @param {string} today
 * @returns {string|null}
 */
export function parseDetailDate(html, today) {
  const ld = html.match(/"startDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
  if (ld) return ld[1];
  const copy = html.match(/\b\d{1,2}\s+de\s+[a-záéíóúü]+(?:\s+de\s+\d{4})?/i);
  return copy ? parseSpanishDate(copy[0], today) : null;
}

/**
 * @param {string} html
 * @returns {Array<{title: string, href: string}>}  cards the listing left undated
 */
export function undatedCards(html) {
  const $ = cheerio.load(html);
  const out = new Map();
  $('.event-home').each((_, el) => {
    const card = $(el);
    const title = card.find('h1').first().text().replace(/\s+/g, ' ').trim();
    const dateText = card.find('.date-home').first().text().trim();
    const href = card.find('a[href*="/events/"]').first().attr('href');
    if (title && href && !dateText && !out.has(href)) out.set(href, { title, href });
  });
  return [...out.values()];
}

/**
 * @param {string} html
 * @param {string} [today]
 * @returns {import('../types.js').RawEvent[]}
 */
export function parse(html, today = new Date().toISOString().slice(0, 10)) {
  const $ = cheerio.load(html);
  /** @type {import('../types.js').RawEvent[]} */
  const out = [];
  const seen = new Set();

  $('.event-home').each((_, el) => {
    const card = $(el);
    const title = card.find('h1').first().text().replace(/\s+/g, ' ').trim();
    const dateText = card.find('.date-home').first().text().replace(/\s+/g, ' ').trim();
    const href = card.find('a[href*="/events/"]').first().attr('href');
    if (!title || !dateText) return;

    const [startText, endText] = dateText.split(/\s+al\s+/i);
    const start = parseSpanishDate(startText, today);
    if (!start) return;
    const end = endText ? parseSpanishDate(endText, today) : null;

    const { artist, venue } = splitTitle(title);
    const ticketUrl = absolute(href);

    const dates = [start];
    if (end && end > start && daysBetween(start, end) <= MAX_RANGE_DAYS) {
      for (let d = addDays(start, 1); d <= end; d = addDays(d, 1)) dates.push(d);
    }

    for (const date of dates) {
      const key = `${artist}|${date}|${venue}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ artist, venue, date, ticketUrl, source: 'livepass' });
    }
  });

  return out;
}

/**
 * @param {{fetchImpl?: (url: string) => Promise<string>, today?: string}} [opts]
 */
export async function fetchAll({ fetchImpl = fetchHtml, today = new Date().toISOString().slice(0, 10) } = {}) {
  const listing = await fetchImpl(URL);
  const out = parse(listing, today);
  const known = new Set(out.map(e => `${e.artist}|${e.venue}`));

  for (const { title, href } of undatedCards(listing)) {
    const { artist, venue } = splitTitle(title);
    if (known.has(`${artist}|${venue}`)) continue;
    let date = null;
    try {
      date = parseDetailDate(await fetchImpl(absolute(href)), today);
    } catch (err) {
      console.warn(`[livepass] detail ${href} failed: ${err.message}`);
    }
    if (!date) continue;
    out.push({ artist, venue, date, ticketUrl: absolute(href), source: 'livepass' });
  }
  return out;
}

export async function fetch() {
  return fetchAll();
}
