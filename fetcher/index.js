import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { normalize } from './normalize.js';
import { dedupe } from './dedupe.js';
import { filterInternational, filterTimeWindow } from './filter.js';
import { applyFirstSeen } from './firstseen.js';
import { checkAdapterHealth, updateHealth } from './health.js';
import { buildCountryCache, buildSpotifyCache, mergeArtistEntry } from './cache.js';
import { resolveAdapterEvents } from './sourcecache.js';
import { lookupCountry } from './enrichers/musicbrainz.js';
import { createSpotifyEnricher } from './enrichers/spotify.js';

import * as songkick from './adapters/songkick.js';
import * as vorterix from './adapters/vorterix.js';
import * as niceto from './adapters/niceto.js';
import { todayInBuenosAires } from './today.js';

const ADAPTERS = [
  ['songkick', songkick],
  ['vorterix', vorterix],
  ['niceto', niceto],
];

const EVENTS_PATH = 'data/events.json';
const ARTISTS_PATH = 'data/artists.json';
const HEALTH_PATH = 'data/health.json';
const SOURCES_DIR = 'data/sources';
const STALE_THRESHOLD = 0.10;

async function runAdapter(name, adapter, previous) {
  let fetched = [];
  try {
    fetched = await adapter.fetch();
    console.log(`[${name}] ${fetched.length} events`);
  } catch (err) {
    console.warn(`[${name}] FAILED: ${err.message}`);
  }

  const cached = await loadJson(`${SOURCES_DIR}/${name}.json`, null);
  const resolved = resolveAdapterEvents({ fetched, cached: cached?.events ?? null, previous });

  if (resolved.usedCache) {
    console.warn(`[${name}] falling back to ${resolved.events.length} cached events from ${cached.fetchedAt}`);
  }
  return { name, ...resolved };
}

async function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadCache() {
  const raw = await loadJson(ARTISTS_PATH, null);
  return raw ? new Map(Object.entries(raw)) : new Map();
}

async function main() {
  const cache = await loadCache();
  const countryCache = buildCountryCache(Object.fromEntries(cache));
  const spotifyCache = buildSpotifyCache(Object.fromEntries(cache));

  const spotify = createSpotifyEnricher({
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  });

  const prevHealth = await loadJson(HEALTH_PATH, {});
  const results = await Promise.all(
    ADAPTERS.map(([name, ad]) => runAdapter(name, ad, prevHealth[name]))
  );

  // Health records what each source actually returned, not what we served.
  const counts = Object.fromEntries(results.map(r => [r.name, r.fetchedCount]));
  const { regressions, down } = checkAdapterHealth(prevHealth, counts);

  for (const d of down) {
    console.warn(`[health] ${d.name} is still down (last worked ${d.lastHealthyAt ?? 'never'})`);
  }
  for (const r of regressions) {
    console.error(`[health] REGRESSION: ${r.name} returned 0 events but produced ${r.previous} on ${r.lastHealthyAt}`);
  }

  const today = todayInBuenosAires();
  await mkdir(SOURCES_DIR, { recursive: true });
  for (const r of results) {
    if (r.fetchedCount > 0) {
      await writeFile(`${SOURCES_DIR}/${r.name}.json`,
        JSON.stringify({ fetchedAt: today, events: r.events }, null, 2) + '\n');
    }
  }
  await writeFile(HEALTH_PATH, JSON.stringify(updateHealth(prevHealth, counts, today), null, 2) + '\n');

  const raw = results.flatMap(r => r.events);
  console.log(`Total raw events: ${raw.length}`);

  const normalized = raw.map(normalize);
  const deduped = dedupe(normalized);
  console.log(`After dedupe: ${deduped.length}`);

  const enriched = [];
  for (const e of deduped) {
    const country = await lookupCountry(e.artist, countryCache);
    const sp = await spotify.lookup(e.artist, spotifyCache);
    enriched.push({ ...e, country, spotifyId: sp?.id ?? null, spotifyImage: sp?.image ?? null });
  }

  const intl = filterInternational(enriched);
  const within = filterTimeWindow(intl, today);
  within.sort((a, b) => a.date.localeCompare(b.date) || a.artist.localeCompare(b.artist));
  console.log(`Final: ${within.length}`);

  const prev = await loadJson(EVENTS_PATH, []);
  if (prev.length > 0 && within.length < prev.length * STALE_THRESHOLD) {
    console.error(`STALE: new count ${within.length} < ${STALE_THRESHOLD * 100}% of previous ${prev.length}. Keeping previous.`);
    process.exit(1);
  }

  const stamped = applyFirstSeen(within, prev, today);
  const newCount = stamped.filter(e => e.firstSeenAt === today).length;
  console.log(`Newly seen today: ${newCount}`);

  await writeFile(EVENTS_PATH, JSON.stringify(stamped, null, 2) + '\n');

  /** @type {Record<string, import('./types.js').ArtistCacheEntry>} */
  const artistsOut = {};
  for (const e of enriched) {
    const k = e.artist.toLowerCase();
    artistsOut[k] = mergeArtistEntry({
      key: k, name: e.artist, prior: cache.get(k), countryCache, spotifyCache, today,
    });
  }
  for (const [k, v] of cache.entries()) {
    if (!artistsOut[k]) artistsOut[k] = v;
  }
  await writeFile(ARTISTS_PATH, JSON.stringify(artistsOut, null, 2) + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
