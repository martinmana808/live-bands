import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { normalize } from './normalize.js';
import { dedupe } from './dedupe.js';
import { filterInternational, filterTimeWindow } from './filter.js';
import { lookupCountry } from './enrichers/musicbrainz.js';
import { createSpotifyEnricher } from './enrichers/spotify.js';

import * as songkick from './adapters/songkick.js';
import * as vorterix from './adapters/vorterix.js';
import * as niceto from './adapters/niceto.js';

const ADAPTERS = [
  ['songkick', songkick],
  ['vorterix', vorterix],
  ['niceto', niceto],
];

const EVENTS_PATH = 'data/events.json';
const ARTISTS_PATH = 'data/artists.json';
const STALE_THRESHOLD = 0.10;

async function runAdapter(name, adapter) {
  try {
    const events = await adapter.fetch();
    console.log(`[${name}] ${events.length} events`);
    return events;
  } catch (err) {
    console.warn(`[${name}] FAILED: ${err.message}`);
    return [];
  }
}

async function loadCache() {
  if (!existsSync(ARTISTS_PATH)) return new Map();
  const raw = JSON.parse(await readFile(ARTISTS_PATH, 'utf8'));
  return new Map(Object.entries(raw));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const cache = await loadCache();
  const countryCache = new Map(
    [...cache.entries()].map(([k, v]) => [k, v.country])
  );
  const spotifyCache = new Map(
    [...cache.entries()].map(([k, v]) => [k, v.spotifyId ? { id: v.spotifyId, image: v.spotifyImage ?? null } : null])
  );

  const spotify = createSpotifyEnricher({
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  });

  const rawArrays = await Promise.all(
    ADAPTERS.map(([name, ad]) => runAdapter(name, ad))
  );
  const raw = rawArrays.flat();
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
  const within = filterTimeWindow(intl, todayStr());
  within.sort((a, b) => a.date.localeCompare(b.date) || a.artist.localeCompare(b.artist));
  console.log(`Final: ${within.length}`);

  const prev = JSON.parse(await readFile(EVENTS_PATH, 'utf8'));
  if (prev.length > 0 && within.length < prev.length * STALE_THRESHOLD) {
    console.error(`STALE: new count ${within.length} < ${STALE_THRESHOLD * 100}% of previous ${prev.length}. Keeping previous.`);
    process.exit(1);
  }

  await writeFile(EVENTS_PATH, JSON.stringify(within, null, 2) + '\n');

  const today = todayStr();
  /** @type {Record<string, import('./types.js').ArtistCacheEntry>} */
  const artistsOut = {};
  for (const e of enriched) {
    const k = e.artist.toLowerCase();
    const cached = spotifyCache.get(k);
    artistsOut[k] = {
      name: e.artist,
      country: countryCache.get(k) ?? null,
      spotifyId: cached?.id ?? null,
      spotifyImage: cached?.image ?? null,
      lookedUpAt: today,
    };
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
