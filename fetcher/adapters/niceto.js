import * as cheerio from 'cheerio';

const URL = 'https://nicetoclub.com/agenda';

function parseDate(text) {
  if (!text) return null;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const months = { enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
    julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12' };
  // Handle "WEEKDAY DAY MONTHNAME" format (no "de", e.g., "JUEVES 7 MAYO")
  const m2 = text.toLowerCase().match(/\b(\d{1,2})\s+([a-záéíóúü]+)\b/);
  if (m2) {
    const day = m2[1].padStart(2, '0');
    const mon = months[m2[2]];
    const year = new Date().getFullYear();
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
  // Each .day-section has an h2 with the date and .event-card children
  $('.day-section').each((_, section) => {
    const h2Text = $(section).find('h2').first().text().trim();
    const date = parseDate(h2Text);
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
  const res = await globalThis.fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`niceto HTTP ${res.status}`);
  return parse(await res.text());
}
