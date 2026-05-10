import * as cheerio from 'cheerio';

// allaccess.com.ar hosts the Teatro Vorterix show listing
const URL = 'https://www.allaccess.com.ar/venue/teatro-vorterix';

function parseDate(text) {
  if (!text) return null;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const months = { enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
    julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12' };
  const m = text.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const mon = months[m[2]];
    const year = m[3] || new Date().getFullYear();
    if (mon) return `${year}-${mon}-${day}`;
  }
  return null;
}

/**
 * @param {string} html
 * @returns {import('../types.js').RawEvent[]}
 */
export function parse(html) {
  const $ = cheerio.load(html);
  /** @type {import('../types.js').RawEvent[]} */
  const out = [];
  $('.show-info').each((_, el) => {
    const artist = $(el).find('h2').text().trim();
    const dateText = $(el).find('h3').text().trim();
    const date = parseDate(dateText);
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
  const res = await globalThis.fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`vorterix HTTP ${res.status}`);
  return parse(await res.text());
}
