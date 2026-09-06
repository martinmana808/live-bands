import * as cheerio from 'cheerio';
import { fetchHtml } from '../http.js';
import { parseSpanishDate } from '../dates.js';

// allaccess.com.ar hosts the Teatro Vorterix show listing
const URL = 'https://www.allaccess.com.ar/venue/teatro-vorterix';


/**
 * @param {string} html
 * @returns {import('../types.js').RawEvent[]}
 */
export function parse(html, today = new Date().toISOString().slice(0, 10)) {
  const $ = cheerio.load(html);
  /** @type {import('../types.js').RawEvent[]} */
  const out = [];
  $('.show-info').each((_, el) => {
    const artist = $(el).find('h2').text().trim();
    const dateText = $(el).find('h3').text().trim();
    const date = parseSpanishDate(dateText, today);
    const ticketUrl = $(el).closest('a').attr('href');
    const fullTicketUrl = ticketUrl
      ? 'https://www.allaccess.com.ar/' + ticketUrl.replace(/^\.\.\//, '')
      : undefined;
    if (!artist || !date) return;
    out.push({
      artist,
      venue: 'Vorterix',
      date,
      ticketUrl: fullTicketUrl || undefined,
      source: 'vorterix',
    });
  });
  return out;
}

export async function fetch() {
  return parse(await fetchHtml(URL));
}
