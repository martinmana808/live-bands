const UA = 'BandsInTown/0.1 (https://github.com/martinmana808/bands-in-town)';

const MIN_SCORE = 90;

/** MusicBrainz asks for one request per second and means it. */
const RATE_LIMIT_MS = Number(process.env.MUSICBRAINZ_RATE_LIMIT_MS ?? 1100);
let nextSlot = 0;

function fold(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * MusicBrainz always returns its closest guess, so "Club 69" comes back as
 * "Sham 69". Only trust a result whose name actually is the name we asked for.
 *
 * @param {Array<{name: string, country?: string|null, score?: number, aliases?: Array<{name: string}>}>} [artists]
 * @param {string} query
 */
export function pickMatch(artists, query) {
  if (!Array.isArray(artists)) return null;
  const want = fold(query);
  if (!want) return null;

  for (const a of artists) {
    if ((a.score ?? 0) < MIN_SCORE) continue;
    const names = [a.name, ...(a.aliases ?? []).map(x => x.name)];
    if (names.some(n => fold(n) === want)) return a;
  }
  return null;
}

async function throttle() {
  const wait = nextSlot - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  nextSlot = Date.now() + RATE_LIMIT_MS;
}

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const ATTEMPTS = 3;

/**
 * @returns {Promise<{artists?: any[]}|null>}  null means "ask again later"
 */
async function query(url) {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok) return res.json();
      if (!RETRY_STATUS.has(res.status)) return { artists: [] };
    } catch {
      // network blip - fall through to the next attempt
    }
  }
  return null;
}

/**
 * @param {string} artistName
 * @param {Map<string, string|null>} cache  keyed by lowercase artist name
 * @returns {Promise<string|null>}  ISO country code or null
 */
export async function lookupCountry(artistName, cache) {
  const key = artistName.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent('artist:' + artistName)}&fmt=json&limit=5`;
  const data = await query(url);

  // A rate limit or a dropped connection is not evidence that the artist is
  // unknown. Leave the cache alone so the next run asks again, rather than
  // freezing a transient failure in as a permanent answer.
  if (data === null) return null;

  const country = pickMatch(data.artists, artistName)?.country ?? null;
  cache.set(key, country);
  return country;
}
