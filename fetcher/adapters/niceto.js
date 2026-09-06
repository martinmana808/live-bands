import * as cheerio from 'cheerio';
import { fetchHtml } from '../http.js';
import { parseSpanishDate } from '../dates.js';

const URL = 'https://nicetoclub.com/agenda';


/**
 * @param {string} html
 * @returns {import('../types.js').RawEvent[]}
 */
export function parse(html, today = new Date().toISOString().slice(0, 10)) {
  const $ = cheerio.load(html);
  /** @type {import('../types.js').RawEvent[]} */
  const out = [];
  // Each .day-section has an h2 with the date and .event-card children
  $('.day-section').each((_, section) => {
    const h2Text = $(section).find('h2').first().text().trim();
    const date = parseSpanishDate(h2Text, today);
    if (!date) return;
    $(section).find('.event-card').each((_, el) => {
      const h3 = $(el).find('h3').text().trim();
      // Artist name is everything before " en Niceto" or " en Humboldt" (the venue name)
      const artistMatch = h3.match(/^(.+?)\s+en\s+/i);
      const artist = artistMatch ? artistMatch[1].trim() : h3;
      const ticketUrl = $(el).find('a[href*="venti"]').attr('href') || undefined;
      if (!artist) return;
      out.push({
        artist,
        venue: 'Niceto Club',
        date,
        ticketUrl,
        source: 'niceto',
      });
    });
  });
  return out;
}

export async function fetch() {
  return parse(await fetchHtml(URL));
}
