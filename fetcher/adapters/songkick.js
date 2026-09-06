import * as cheerio from 'cheerio';
import { fetchHtml } from '../http.js';

const URL_BA = 'https://www.songkick.com/metro-areas/32911-argentina-buenos-aires';

/**
 * @param {string} html
 * @returns {import('../types.js').RawEvent[]}
 */
export function parse(html) {
  const $ = cheerio.load(html);
  /** @type {import('../types.js').RawEvent[]} */
  const out = [];
  $('li.event-listings-element').each((_, el) => {
    const artist = $(el).find('p.artists strong').first().text().trim();
    const date = $(el).find('time').attr('datetime')?.slice(0, 10) ?? '';
    const venue = $(el).find('p.location a.venue-link').first().text().trim();
    if (!artist || !venue || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    out.push({ artist, venue, date, source: 'songkick' });
  });
  return out;
}

export async function fetch() {
  return parse(await fetchHtml(URL_BA));
}
