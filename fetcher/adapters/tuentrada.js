import { fetchHtml } from '../http.js';

// Tuentrada sells for Luna Park, Gran Rex, Teatro Ópera and most of the mid-size
// venues international acts play. The listing is Next.js tiles with a slug and
// a name; dates live on each event page, in an eventSessions array inside the
// RSC payload. Pages are fetched once and cached for DETAIL_TTL_DAYS.
const ORIGIN = 'https://www.tuentrada.com';
const LISTING = `${ORIGIN}/`;

export const DETAIL_TTL_DAYS = 14;

// Greater Buenos Aires; La Plata is close enough to count.
const CITY = /buenos aires|caba|capital federal|la plata|gba|zona (norte|sur|oeste)|san isidro|vicente l[oó]pez|tigre|avellaneda|lan[uú]s|quilmes|mor[oó]n|san mart[ií]n|hurlingham|pilar|escobar/i;

/**
 * Next.js streams its tree as escaped JSON strings inside self.__next_f.push
 * calls. Unescape and join them to get something searchable.
 */
function rscBlob(html) {
  const out = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(`"${m[1]}"`)); } catch { /* skip a chunk we cannot decode */ }
  }
  return out.join('\n');
}

/**
 * @param {string} html
 * @returns {Array<{slug: string, name: string}>}
 */
export function parseListing(html) {
  const blob = rscBlob(html);
  const seen = new Map();
  const re = /"alt":"((?:[^"\\]|\\.)*)"[^{}]*?"href":"([a-z0-9][a-z0-9\-]*)"/g;
  let m;
  while ((m = re.exec(blob))) {
    const slug = m[2];
    const name = m[1].replace(/\\"/g, '"').trim();
    if (!name || seen.has(slug)) continue;
    seen.set(slug, { slug, name });
  }
  return [...seen.values()];
}

/**
 * @param {string} html
 * @returns {Array<{date: string, venue: string, city: string, name: string}>}
 */
export function parseDetail(html) {
  const blob = rscBlob(html);
  const start = blob.indexOf('"eventSessions":[');
  if (start === -1) return [];
  // Walk to the matching bracket rather than regex the whole array.
  let i = start + '"eventSessions":'.length;
  let depth = 0;
  let end = -1;
  for (; i < blob.length; i++) {
    if (blob[i] === '[') depth++;
    else if (blob[i] === ']' && --depth === 0) { end = i + 1; break; }
  }
  if (end === -1) return [];
  let sessions;
  try { sessions = JSON.parse(blob.slice(start + '"eventSessions":'.length, end)); } catch { return []; }
  return sessions
    .filter(s => typeof s?.date === 'string')
    .map(s => ({
      date: s.date.slice(0, 10),
      venue: String(s.venue ?? '').trim(),
      city: String(s.city ?? '').trim(),
      name: String(s.name ?? '').trim(),
    }));
}

function ageInDays(fromIso, toIso) {
  return (Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000;
}

/**
 * @param {{fetchImpl?: (url: string) => Promise<string>, cache?: Record<string, {fetchedAt: string, sessions: any[]}>, today?: string}} [opts]
 * @returns {Promise<{events: import('../types.js').RawEvent[], cache: Record<string, {fetchedAt: string, sessions: any[]}>}>}
 */
export async function fetchAll({ fetchImpl = fetchHtml, cache = {}, today = new Date().toISOString().slice(0, 10) } = {}) {
  const tiles = parseListing(await fetchImpl(LISTING));
  /** @type {Record<string, {fetchedAt: string, sessions: any[]}>} */
  const next = {};
  const events = [];

  for (const { slug, name } of tiles) {
    const prior = cache[slug];
    const fresh = prior && ageInDays(prior.fetchedAt, today) <= DETAIL_TTL_DAYS;
    let entry = fresh ? prior : null;

    if (!entry) {
      try {
        entry = { fetchedAt: today, sessions: parseDetail(await fetchImpl(`${ORIGIN}/${slug}`)) };
      } catch (err) {
        console.warn(`[tuentrada] ${slug}: ${err.message}`);
        entry = prior ?? null;
      }
    }
    if (!entry) continue;
    next[slug] = entry;

    for (const s of entry.sessions) {
      if (s.city && !CITY.test(s.city)) continue;
      events.push({
        artist: s.name || name,
        venue: s.venue || 'Tuentrada',
        date: s.date,
        ticketUrl: `${ORIGIN}/${slug}`,
        source: 'tuentrada',
      });
    }
  }
  return { events, cache: next };
}

const CACHE_PATH = 'data/sources/tuentrada-details.json';

export async function fetch() {
  const { readFile, writeFile, mkdir } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const { todayInBuenosAires } = await import('../today.js');
  const cache = existsSync(CACHE_PATH) ? JSON.parse(await readFile(CACHE_PATH, 'utf8')) : {};
  const { events, cache: next } = await fetchAll({ cache, today: todayInBuenosAires() });
  await mkdir('data/sources', { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(next, null, 2) + '\n');
  return events;
}
