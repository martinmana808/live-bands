# Bands in Town — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 MVP of Bands in Town — a public, read-only static website listing international bands playing in Buenos Aires, rebuilt daily from multiple sources.

**Architecture:** A Node fetcher pulls events from pluggable source adapters, normalizes them, dedupes across sources, enriches with origin country and Spotify ID, and writes `data/events.json`. An Astro site reads that JSON at build time and renders a chronological page. A GitHub Actions cron job rebuilds and deploys daily to GitHub Pages.

**Tech Stack:** Node 20 (ESM), Vitest (tests), Astro (static site), GitHub Actions (cron + deploy), GitHub Pages (hosting). All sources fetched via `fetch()` with `cheerio` for HTML parsing. No TypeScript — JSDoc for types.

**Spec:** `docs/superpowers/specs/2026-05-09-bands-in-town-design.md`

---

## File Structure

```
bands-in-town/
├── package.json
├── astro.config.mjs
├── vitest.config.js
├── .gitignore
├── .github/workflows/
│   └── daily-rebuild.yml
├── fetcher/
│   ├── types.js                    # JSDoc typedefs only
│   ├── normalize.js                # raw → normalized event
│   ├── dedupe.js                   # cross-source merge
│   ├── filter.js                   # international + time filters
│   ├── adapters/
│   │   ├── bandsintown.js
│   │   ├── songkick.js
│   │   ├── vorterix.js
│   │   └── niceto.js
│   ├── enrichers/
│   │   ├── musicbrainz.js          # origin country lookup
│   │   └── spotify.js              # artist ID lookup
│   └── index.js                    # orchestrator
├── data/
│   ├── events.json                 # produced by fetcher
│   └── artists.json                # enrichment cache
├── src/
│   ├── pages/index.astro
│   ├── components/
│   │   ├── EventRow.astro
│   │   └── MonthHeading.astro
│   └── styles/global.css
├── tests/
│   ├── fixtures/                   # saved HTML/JSON for adapters
│   ├── normalize.test.js
│   ├── dedupe.test.js
│   ├── filter.test.js
│   ├── adapters/
│   │   └── bandsintown.test.js
│   └── enrichers/
│       └── musicbrainz.test.js
└── README.md
```

**Boundaries:**
- **Adapters** know about one source and produce `RawEvent[]`. Nothing else.
- **Enrichers** look up artist metadata. Pure (apart from network), cached.
- **Normalize/dedupe/filter** are pure functions. No I/O.
- **Orchestrator** is the only place that does I/O and composes everything.
- **Astro** reads `data/events.json` and renders. Knows nothing about fetching.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `.gitignore`, `vitest.config.js`, `astro.config.mjs`, `.nvmrc`

- [ ] **Step 1: Initialize npm project**

Run:
```bash
npm init -y
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install astro
npm install -D vitest cheerio
```

- [ ] **Step 3: Update `package.json`**

Set `"type": "module"`. Replace `scripts` with:

```json
"scripts": {
  "fetch": "node fetcher/index.js",
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Set `"engines": { "node": ">=20" }`.

- [ ] **Step 4: Create `.nvmrc`**

```
20
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.astro/
.env
.env.local
.DS_Store
coverage/
```

- [ ] **Step 6: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 7: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bands-in-town.example',  // replace when domain known
  output: 'static',
});
```

- [ ] **Step 8: Verify install**

Run:
```bash
npm test
```
Expected: "No test files found" (pass — no tests yet, which is fine for vitest).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore vitest.config.js astro.config.mjs .nvmrc
git commit -m "chore: scaffold Astro + Vitest project"
```

---

## Task 2: Define data shapes

**Files:**
- Create: `fetcher/types.js`

- [ ] **Step 1: Write JSDoc typedefs**

```js
// fetcher/types.js

/**
 * @typedef {Object} RawEvent
 * @property {string} artist          - Artist name as it appears on the source
 * @property {string} date            - ISO date "YYYY-MM-DD"
 * @property {string} venue           - Venue name as it appears on the source
 * @property {string} [ticketUrl]     - Direct ticket URL if available
 * @property {string} source          - Source adapter id (e.g. "bandsintown")
 */

/**
 * @typedef {Object} NormalizedEvent
 * @property {string} id              - Stable id: slug(artist)-date-slug(venue)
 * @property {string} artist          - Artist display name
 * @property {string} artistKey       - Normalized lowercase key for lookups
 * @property {string} date            - ISO date "YYYY-MM-DD"
 * @property {string} venue           - Venue display name
 * @property {string} venueKey        - Normalized lowercase key for matching
 * @property {string[]} ticketUrls    - All ticket URLs across sources
 * @property {string[]} sources       - Source ids that reported this event
 */

/**
 * @typedef {Object} EnrichedEvent
 * @property {string} id
 * @property {string} artist
 * @property {string} artistKey
 * @property {string} date
 * @property {string} venue
 * @property {string[]} ticketUrls
 * @property {string[]} sources
 * @property {string|null} country    - ISO 3166-1 alpha-2, or null if unknown
 * @property {string|null} spotifyId  - Spotify artist id, or null
 */

/**
 * @typedef {Object} ArtistCacheEntry
 * @property {string} name
 * @property {string|null} country
 * @property {string|null} spotifyId
 * @property {string} lookedUpAt     - ISO date
 */

export {};
```

- [ ] **Step 2: Commit**

```bash
git add fetcher/types.js
git commit -m "feat: define event and artist typedefs"
```

---

## Task 3: Normalizer

The normalizer turns a `RawEvent` into a `NormalizedEvent` with stable keys for matching. Key rules:
- `artistKey`: lowercase, strip non-alphanumerics
- `venueKey`: lowercase, strip non-alphanumerics, drop common words ("club", "teatro", "estadio")
- `id`: `<artistKey>-<date>-<venueKey>`

**Files:**
- Create: `tests/normalize.test.js`, `fetcher/normalize.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/normalize.test.js
import { describe, it, expect } from 'vitest';
import { normalize } from '../fetcher/normalize.js';

describe('normalize', () => {
  it('produces a stable id from artist+date+venue', () => {
    const out = normalize({
      artist: 'Korn',
      date: '2026-05-14',
      venue: 'Movistar Arena',
      ticketUrl: 'https://x',
      source: 'bandsintown',
    });
    expect(out.id).toBe('korn-2026-05-14-movistararena');
  });

  it('lowercases and strips non-alphanumerics for keys', () => {
    const out = normalize({
      artist: 'KoRn!',
      date: '2026-05-14',
      venue: 'C-Art Media',
      source: 'bandsintown',
    });
    expect(out.artistKey).toBe('korn');
    expect(out.venueKey).toBe('cartmedia');
  });

  it('drops common venue words from venueKey', () => {
    const a = normalize({ artist: 'X', date: '2026-01-01', venue: 'Niceto Club', source: 's' });
    const b = normalize({ artist: 'X', date: '2026-01-01', venue: 'Niceto', source: 's' });
    expect(a.venueKey).toBe(b.venueKey);
  });

  it('puts ticketUrl into ticketUrls array (or empty if missing)', () => {
    const a = normalize({ artist: 'X', date: '2026-01-01', venue: 'V', ticketUrl: 'http://t', source: 's' });
    const b = normalize({ artist: 'X', date: '2026-01-01', venue: 'V', source: 's' });
    expect(a.ticketUrls).toEqual(['http://t']);
    expect(b.ticketUrls).toEqual([]);
  });

  it('records the source in sources', () => {
    const out = normalize({ artist: 'X', date: '2026-01-01', venue: 'V', source: 'bandsintown' });
    expect(out.sources).toEqual(['bandsintown']);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/normalize.test.js`
Expected: FAIL — `normalize` is not defined.

- [ ] **Step 3: Implement `normalize`**

```js
// fetcher/normalize.js
const VENUE_STOPWORDS = new Set(['club', 'teatro', 'estadio', 'arena', 'bar', 'el', 'la', 'de']);

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
}

function venueSlug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(w => w && !VENUE_STOPWORDS.has(w))
    .join('');
}

/**
 * @param {import('./types.js').RawEvent} raw
 * @returns {import('./types.js').NormalizedEvent}
 */
export function normalize(raw) {
  const artistKey = slug(raw.artist);
  const venueKey = venueSlug(raw.venue);
  return {
    id: `${artistKey}-${raw.date}-${venueKey}`,
    artist: raw.artist,
    artistKey,
    date: raw.date,
    venue: raw.venue,
    venueKey,
    ticketUrls: raw.ticketUrl ? [raw.ticketUrl] : [],
    sources: [raw.source],
  };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/normalize.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add fetcher/normalize.js tests/normalize.test.js
git commit -m "feat: normalize raw events into stable-key form"
```

---

## Task 4: Deduper

The deduper merges normalized events that refer to the same show across sources. Match key: `(artistKey, date, venueKey)`. Merge strategy: union of `ticketUrls`, union of `sources`, prefer the longest `artist` and `venue` display strings.

**Files:**
- Create: `tests/dedupe.test.js`, `fetcher/dedupe.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/dedupe.test.js
import { describe, it, expect } from 'vitest';
import { dedupe } from '../fetcher/dedupe.js';

const norm = (over = {}) => ({
  id: 'x',
  artist: 'X',
  artistKey: 'x',
  date: '2026-05-14',
  venue: 'V',
  venueKey: 'v',
  ticketUrls: [],
  sources: ['a'],
  ...over,
});

describe('dedupe', () => {
  it('keeps distinct events distinct', () => {
    const out = dedupe([
      norm({ artistKey: 'a' }),
      norm({ artistKey: 'b' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('merges events with same artist+date+venue keys', () => {
    const out = dedupe([
      norm({ ticketUrls: ['http://1'], sources: ['bandsintown'] }),
      norm({ ticketUrls: ['http://2'], sources: ['ticketek'] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].ticketUrls.sort()).toEqual(['http://1', 'http://2']);
    expect(out[0].sources.sort()).toEqual(['bandsintown', 'ticketek']);
  });

  it('prefers the longer display name when merging', () => {
    const out = dedupe([
      norm({ artist: 'Korn' }),
      norm({ artist: 'KORN (Live)' }),
    ]);
    expect(out[0].artist).toBe('KORN (Live)');
  });

  it('deduplicates ticket URLs', () => {
    const out = dedupe([
      norm({ ticketUrls: ['http://1'] }),
      norm({ ticketUrls: ['http://1'] }),
    ]);
    expect(out[0].ticketUrls).toEqual(['http://1']);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/dedupe.test.js`
Expected: FAIL — `dedupe` not defined.

- [ ] **Step 3: Implement `dedupe`**

```js
// fetcher/dedupe.js

/**
 * @param {import('./types.js').NormalizedEvent[]} events
 * @returns {import('./types.js').NormalizedEvent[]}
 */
export function dedupe(events) {
  /** @type {Map<string, import('./types.js').NormalizedEvent>} */
  const map = new Map();
  for (const e of events) {
    const key = `${e.artistKey}|${e.date}|${e.venueKey}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...e });
      continue;
    }
    map.set(key, {
      ...prev,
      artist: prev.artist.length >= e.artist.length ? prev.artist : e.artist,
      venue: prev.venue.length >= e.venue.length ? prev.venue : e.venue,
      ticketUrls: [...new Set([...prev.ticketUrls, ...e.ticketUrls])],
      sources: [...new Set([...prev.sources, ...e.sources])],
    });
  }
  return [...map.values()];
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/dedupe.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add fetcher/dedupe.js tests/dedupe.test.js
git commit -m "feat: dedupe events across sources by artist+date+venue"
```

---

## Task 5: International + time filters

Two pure filters in one file:
- `filterInternational(events)` — drops events whose `country === 'AR'`. Unknown country (`null`) is kept (long-tail bias).
- `filterTimeWindow(events, today)` — keeps events from `today - 30d` onward. `today` is a string `"YYYY-MM-DD"` (injectable for tests).

**Files:**
- Create: `tests/filter.test.js`, `fetcher/filter.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/filter.test.js
import { describe, it, expect } from 'vitest';
import { filterInternational, filterTimeWindow } from '../fetcher/filter.js';

const ev = (over = {}) => ({
  id: 'x', artist: 'X', artistKey: 'x',
  date: '2026-05-14', venue: 'V', venueKey: 'v',
  ticketUrls: [], sources: [], country: null, spotifyId: null,
  ...over,
});

describe('filterInternational', () => {
  it('drops AR artists', () => {
    expect(filterInternational([ev({ country: 'AR' })])).toEqual([]);
  });
  it('keeps non-AR artists', () => {
    expect(filterInternational([ev({ country: 'US' })])).toHaveLength(1);
  });
  it('keeps unknown-country artists (long-tail bias)', () => {
    expect(filterInternational([ev({ country: null })])).toHaveLength(1);
  });
});

describe('filterTimeWindow', () => {
  const today = '2026-05-09';
  it('drops events older than 30 days before today', () => {
    expect(filterTimeWindow([ev({ date: '2026-04-08' })], today)).toEqual([]);
  });
  it('keeps events within the past 30 days', () => {
    expect(filterTimeWindow([ev({ date: '2026-04-10' })], today)).toHaveLength(1);
  });
  it('keeps today', () => {
    expect(filterTimeWindow([ev({ date: today })], today)).toHaveLength(1);
  });
  it('keeps future events', () => {
    expect(filterTimeWindow([ev({ date: '2027-01-01' })], today)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/filter.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement filters**

```js
// fetcher/filter.js

/**
 * @param {import('./types.js').EnrichedEvent[]} events
 */
export function filterInternational(events) {
  return events.filter(e => e.country !== 'AR');
}

/**
 * @param {import('./types.js').EnrichedEvent[]} events
 * @param {string} today  - "YYYY-MM-DD"
 */
export function filterTimeWindow(events, today) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return events.filter(e => e.date >= cutoffStr);
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/filter.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add fetcher/filter.js tests/filter.test.js
git commit -m "feat: international and time-window filters"
```

---

## Task 6: MusicBrainz enricher with cache

Looks up an artist's origin country via MusicBrainz, caching results in a passed-in `Map`. Failures (not found, network error) cache `null` so we don't retry every run.

**MusicBrainz API:** `https://musicbrainz.org/ws/2/artist/?query=artist:<name>&fmt=json` returns artists; take `artists[0].country` if present. Required: `User-Agent` header (their ToS).

**Files:**
- Create: `tests/enrichers/musicbrainz.test.js`, `fetcher/enrichers/musicbrainz.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/enrichers/musicbrainz.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupCountry } from '../../fetcher/enrichers/musicbrainz.js';

describe('lookupCountry', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns country from MusicBrainz response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ artists: [{ country: 'US' }] }),
    }));
    const cache = new Map();
    expect(await lookupCountry('Korn', cache)).toBe('US');
  });

  it('returns null when no artists found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ artists: [] }),
    }));
    expect(await lookupCountry('Nope', new Map())).toBe(null);
  });

  it('returns null on HTTP error and does not throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await lookupCountry('Korn', new Map())).toBe(null);
  });

  it('returns null on network error and does not throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')));
    expect(await lookupCountry('Korn', new Map())).toBe(null);
  });

  it('uses cache without calling fetch a second time', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ artists: [{ country: 'DE' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const cache = new Map();
    await lookupCountry('Mantar', cache);
    await lookupCountry('Mantar', cache);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/enrichers/musicbrainz.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `lookupCountry`**

```js
// fetcher/enrichers/musicbrainz.js
const UA = 'BandsInTown/0.1 (https://github.com/your/repo)';

/**
 * @param {string} artistName
 * @param {Map<string, string|null>} cache  keyed by lowercase artist name
 * @returns {Promise<string|null>}  ISO country code or null
 */
export async function lookupCountry(artistName, cache) {
  const key = artistName.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent('artist:' + artistName)}&fmt=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json();
    const country = data?.artists?.[0]?.country ?? null;
    cache.set(key, country);
    return country;
  } catch {
    cache.set(key, null);
    return null;
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/enrichers/musicbrainz.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add fetcher/enrichers/musicbrainz.js tests/enrichers/musicbrainz.test.js
git commit -m "feat: MusicBrainz origin-country enricher with cache"
```

---

## Task 7: Spotify enricher with cache

Looks up an artist's Spotify ID via Spotify Web API. Uses Client Credentials flow — needs `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` env vars. Tokens are fetched lazily and cached in-memory for the run.

**Files:**
- Create: `tests/enrichers/spotify.test.js`, `fetcher/enrichers/spotify.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/enrichers/spotify.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSpotifyEnricher } from '../../fetcher/enrichers/spotify.js';

describe('createSpotifyEnricher', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('returns null when credentials missing', async () => {
    const enrich = createSpotifyEnricher({ clientId: '', clientSecret: '' });
    expect(await enrich.lookupId('Korn', new Map())).toBe(null);
  });

  it('looks up an artist id and caches it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [{ id: 'sp1' }] } }) });
    vi.stubGlobal('fetch', fetchMock);
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    const cache = new Map();
    expect(await enrich.lookupId('Korn', cache)).toBe('sp1');
    expect(await enrich.lookupId('Korn', cache)).toBe('sp1');
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 token + 1 search; cache hit on 2nd call
  });

  it('returns null when no artist matches', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: { items: [] } }) })
    );
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    expect(await enrich.lookupId('Nope', new Map())).toBe(null);
  });

  it('returns null on token failure and does not throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const enrich = createSpotifyEnricher({ clientId: 'a', clientSecret: 'b' });
    expect(await enrich.lookupId('Korn', new Map())).toBe(null);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/enrichers/spotify.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement enricher**

```js
// fetcher/enrichers/spotify.js

/**
 * @param {{clientId: string, clientSecret: string}} creds
 */
export function createSpotifyEnricher({ clientId, clientSecret }) {
  let token = null;

  async function getToken() {
    if (token) return token;
    if (!clientId || !clientSecret) return null;
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        },
        body: 'grant_type=client_credentials',
      });
      if (!res.ok) return null;
      const data = await res.json();
      token = data.access_token;
      return token;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} artistName
   * @param {Map<string, string|null>} cache
   * @returns {Promise<string|null>}
   */
  async function lookupId(artistName, cache) {
    const key = artistName.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const tk = await getToken();
    if (!tk) {
      cache.set(key, null);
      return null;
    }
    try {
      const url = `https://api.spotify.com/v1/search?type=artist&limit=1&q=${encodeURIComponent(artistName)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      if (!res.ok) { cache.set(key, null); return null; }
      const data = await res.json();
      const id = data?.artists?.items?.[0]?.id ?? null;
      cache.set(key, id);
      return id;
    } catch {
      cache.set(key, null);
      return null;
    }
  }

  return { lookupId };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run tests/enrichers/spotify.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add fetcher/enrichers/spotify.js tests/enrichers/spotify.test.js
git commit -m "feat: Spotify artist-id enricher with cache + client-credentials auth"
```

---

## Task 8: Bandsintown adapter (worked example)

The adapter contract: `export async function fetch() => Promise<RawEvent[]>`. We test the *parser* against a saved fixture; the actual `fetch()` exported function wraps the parser plus a real HTTP call. Parser is exported separately for testability.

**Approach:** Bandsintown's city pages embed JSON in a `<script id="__NEXT_DATA__">` tag (Next.js hydration data). Parse that JSON. The exact path inside `__NEXT_DATA__` depends on their build — engineer must inspect a saved page once. Treat the test fixture as ground truth: fetch the live page, save it to `tests/fixtures/bandsintown-buenos-aires.html`, write the test against it, then write the parser to make the test pass.

**Files:**
- Create: `tests/fixtures/bandsintown-buenos-aires.html`, `tests/adapters/bandsintown.test.js`, `fetcher/adapters/bandsintown.js`

- [ ] **Step 1: Capture a real fixture**

Run:
```bash
curl -A "Mozilla/5.0" -L "https://www.bandsintown.com/c/buenos-aires-argentina" -o tests/fixtures/bandsintown-buenos-aires.html
```

Open the file. Find the `<script id="__NEXT_DATA__" type="application/json">` block. Inspect its JSON to find the events list. Note the path (commonly `props.pageProps.events` or similar). Record what fields are available on each event (artist name, date, venue name, ticket URL).

- [ ] **Step 2: Write failing test**

```js
// tests/adapters/bandsintown.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../fetcher/adapters/bandsintown.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../fixtures/bandsintown-buenos-aires.html'), 'utf8');

describe('bandsintown parser', () => {
  it('returns at least one event', () => {
    const events = parse(html);
    expect(events.length).toBeGreaterThan(0);
  });

  it('every event has artist, date, venue, source=bandsintown', () => {
    const events = parse(html);
    for (const e of events) {
      expect(typeof e.artist).toBe('string');
      expect(e.artist.length).toBeGreaterThan(0);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof e.venue).toBe('string');
      expect(e.source).toBe('bandsintown');
    }
  });
});
```

- [ ] **Step 3: Verify test fails**

Run: `npx vitest run tests/adapters/bandsintown.test.js`
Expected: FAIL — `parse` not exported.

- [ ] **Step 4: Implement parser + fetcher**

Inspect the fixture's `__NEXT_DATA__` JSON to find the right path. The parser below assumes `props.pageProps.events` — adjust the path to match what you found.

```js
// fetcher/adapters/bandsintown.js
import * as cheerio from 'cheerio';

const CITY_URL = 'https://www.bandsintown.com/c/buenos-aires-argentina';

/**
 * @param {string} html
 * @returns {import('../types.js').RawEvent[]}
 */
export function parse(html) {
  const $ = cheerio.load(html);
  const json = $('script#__NEXT_DATA__').html();
  if (!json) return [];
  const data = JSON.parse(json);
  // Adjust path to match what you found in the fixture:
  const events = data?.props?.pageProps?.events ?? [];
  /** @type {import('../types.js').RawEvent[]} */
  const out = [];
  for (const e of events) {
    const artist = e?.artist?.name ?? e?.artistName;
    const venue = e?.venue?.name ?? e?.venueName;
    const date = (e?.startsAt ?? e?.date ?? '').slice(0, 10);
    if (!artist || !venue || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      artist,
      venue,
      date,
      ticketUrl: e?.ticketUrl ?? undefined,
      source: 'bandsintown',
    });
  }
  return out;
}

export async function fetch() {
  const res = await globalThis.fetch(CITY_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 BandsInTown-Aggregator/0.1' },
  });
  if (!res.ok) throw new Error(`bandsintown HTTP ${res.status}`);
  const html = await res.text();
  return parse(html);
}
```

- [ ] **Step 5: Verify tests pass**

Run: `npx vitest run tests/adapters/bandsintown.test.js`
Expected: PASS (2 tests). If it fails, inspect the fixture's JSON path again and adjust the parser. The test is the contract.

- [ ] **Step 6: Commit**

```bash
git add fetcher/adapters/bandsintown.js tests/adapters/bandsintown.test.js tests/fixtures/bandsintown-buenos-aires.html
git commit -m "feat: bandsintown adapter parsing __NEXT_DATA__"
```

---

## Task 9: Songkick adapter

Songkick's city/metro pages list upcoming concerts. URL: `https://www.songkick.com/metro-areas/32825-argentina-buenos-aires`. Concerts are in `<li class="event-listings-element">` blocks in the rendered HTML. Each block contains artist, date (often as `<time datetime="...">`), and venue.

**Files:**
- Create: `tests/fixtures/songkick-buenos-aires.html`, `tests/adapters/songkick.test.js`, `fetcher/adapters/songkick.js`

- [ ] **Step 1: Capture a real fixture**

Run:
```bash
curl -A "Mozilla/5.0" -L "https://www.songkick.com/metro-areas/32825-argentina-buenos-aires" -o tests/fixtures/songkick-buenos-aires.html
```

Open the file. Inspect the structure of one `li.event-listings-element`. Note the selector for artist name, the `datetime` attribute on `<time>`, and the venue selector.

- [ ] **Step 2: Write failing test**

```js
// tests/adapters/songkick.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../fetcher/adapters/songkick.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../fixtures/songkick-buenos-aires.html'), 'utf8');

describe('songkick parser', () => {
  it('returns events', () => {
    expect(parse(html).length).toBeGreaterThan(0);
  });
  it('every event has artist, date, venue, source=songkick', () => {
    for (const e of parse(html)) {
      expect(e.artist.length).toBeGreaterThan(0);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.venue.length).toBeGreaterThan(0);
      expect(e.source).toBe('songkick');
    }
  });
});
```

- [ ] **Step 3: Verify test fails**

Run: `npx vitest run tests/adapters/songkick.test.js`
Expected: FAIL.

- [ ] **Step 4: Implement parser + fetcher**

Adjust selectors to match what you saw in the fixture.

```js
// fetcher/adapters/songkick.js
import * as cheerio from 'cheerio';

const URL_BA = 'https://www.songkick.com/metro-areas/32825-argentina-buenos-aires';

/**
 * @param {string} html
 * @returns {import('../types.js').RawEvent[]}
 */
export function parse(html) {
  const $ = cheerio.load(html);
  /** @type {import('../types.js').RawEvent[]} */
  const out = [];
  $('li.event-listings-element').each((_, el) => {
    const artist = $(el).find('p.artists strong').first().text().trim()
      || $(el).find('a.event-link').first().text().trim();
    const date = $(el).find('time').attr('datetime')?.slice(0, 10) ?? '';
    const venue = $(el).find('p.location').text().trim().split(',')[0].trim();
    if (!artist || !venue || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    out.push({ artist, venue, date, source: 'songkick' });
  });
  return out;
}

export async function fetch() {
  const res = await globalThis.fetch(URL_BA, {
    headers: { 'User-Agent': 'Mozilla/5.0 BandsInTown-Aggregator/0.1' },
  });
  if (!res.ok) throw new Error(`songkick HTTP ${res.status}`);
  return parse(await res.text());
}
```

- [ ] **Step 5: Verify tests pass**

Run: `npx vitest run tests/adapters/songkick.test.js`
Expected: PASS (2 tests). Adjust selectors if needed and re-run until green.

- [ ] **Step 6: Commit**

```bash
git add fetcher/adapters/songkick.js tests/adapters/songkick.test.js tests/fixtures/songkick-buenos-aires.html
git commit -m "feat: songkick adapter for Buenos Aires metro"
```

---

## Task 10: Two venue adapters (Vorterix, Niceto)

Repeat the adapter pattern from Task 8/9 for two venues. Each venue's HTML structure is unique — inspect the fixture, write selectors, make the test pass.

**Files (per venue):**
- Create: `tests/fixtures/<venue>.html`, `tests/adapters/<venue>.test.js`, `fetcher/adapters/<venue>.js`

### Vorterix (https://www.vorterix.com/agenda)

- [ ] **Step 1: Capture fixture**

```bash
curl -A "Mozilla/5.0" -L "https://www.vorterix.com/agenda" -o tests/fixtures/vorterix.html
```

- [ ] **Step 2: Inspect HTML**

Open the fixture. Find the repeating element for each show. Identify selectors for artist, date, ticket link.

- [ ] **Step 3: Write failing test**

```js
// tests/adapters/vorterix.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../fetcher/adapters/vorterix.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../fixtures/vorterix.html'), 'utf8');

describe('vorterix parser', () => {
  it('returns events with required fields', () => {
    const events = parse(html);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.artist.length).toBeGreaterThan(0);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.venue).toBe('Vorterix');
      expect(e.source).toBe('vorterix');
    }
  });
});
```

- [ ] **Step 4: Implement parser**

```js
// fetcher/adapters/vorterix.js
import * as cheerio from 'cheerio';

const URL = 'https://www.vorterix.com/agenda';

/**
 * @param {string} html
 * @returns {import('../types.js').RawEvent[]}
 */
export function parse(html) {
  const $ = cheerio.load(html);
  const out = [];
  // Adjust the selector below to match the actual repeating element in the fixture:
  $('.agenda-item, .show-item, article').each((_, el) => {
    const artist = $(el).find('h2, h3, .title').first().text().trim();
    const dateText = $(el).find('time, .date').first().attr('datetime')
      || $(el).find('time, .date').first().text().trim();
    const date = parseDate(dateText);
    const ticketUrl = $(el).find('a.ticket, a[href*="ticket"]').first().attr('href');
    if (!artist || !date) return;
    out.push({ artist, venue: 'Vorterix', date, ticketUrl, source: 'vorterix' });
  });
  return out;
}

function parseDate(text) {
  if (!text) return null;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Spanish "12 de septiembre de 2026"
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

export async function fetch() {
  const res = await globalThis.fetch(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 BandsInTown-Aggregator/0.1' },
  });
  if (!res.ok) throw new Error(`vorterix HTTP ${res.status}`);
  return parse(await res.text());
}
```

- [ ] **Step 5: Iterate until test passes**

Run: `npx vitest run tests/adapters/vorterix.test.js`
Adjust the repeating-element selector in `parse()` until the test passes against your fixture.

- [ ] **Step 6: Commit**

```bash
git add fetcher/adapters/vorterix.js tests/adapters/vorterix.test.js tests/fixtures/vorterix.html
git commit -m "feat: vorterix venue adapter"
```

### Niceto (https://www.nicetoclub.com/)

- [ ] **Step 7: Repeat the same flow for Niceto**

Capture fixture:
```bash
curl -A "Mozilla/5.0" -L "https://www.nicetoclub.com/" -o tests/fixtures/niceto.html
```

Create `tests/adapters/niceto.test.js` (analogous to vorterix.test.js but with `venue: 'Niceto Club'` and `source: 'niceto'`).

Create `fetcher/adapters/niceto.js` modeled on `vorterix.js`. Reuse the `parseDate` logic (you can copy it — two short copies is fine, only abstract if you find a third use).

- [ ] **Step 8: Test passes**

Run: `npx vitest run tests/adapters/niceto.test.js`

- [ ] **Step 9: Commit**

```bash
git add fetcher/adapters/niceto.js tests/adapters/niceto.test.js tests/fixtures/niceto.html
git commit -m "feat: niceto venue adapter"
```

---

## Task 11: Orchestrator

Wires everything together: load cache, run adapters in parallel (each isolated by try/catch), normalize, dedupe, enrich (with cache), filter international, filter time, sort, write outputs. Includes the stale-data safety net.

**Files:**
- Create: `fetcher/index.js`, `data/events.json` (empty `[]`), `data/artists.json` (empty `{}`)

- [ ] **Step 1: Seed empty data files**

Create `data/events.json`:
```json
[]
```

Create `data/artists.json`:
```json
{}
```

- [ ] **Step 2: Implement orchestrator**

```js
// fetcher/index.js
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { normalize } from './normalize.js';
import { dedupe } from './dedupe.js';
import { filterInternational, filterTimeWindow } from './filter.js';
import { lookupCountry } from './enrichers/musicbrainz.js';
import { createSpotifyEnricher } from './enrichers/spotify.js';

import * as bandsintown from './adapters/bandsintown.js';
import * as songkick from './adapters/songkick.js';
import * as vorterix from './adapters/vorterix.js';
import * as niceto from './adapters/niceto.js';

const ADAPTERS = [
  ['bandsintown', bandsintown],
  ['songkick', songkick],
  ['vorterix', vorterix],
  ['niceto', niceto],
];

const EVENTS_PATH = 'data/events.json';
const ARTISTS_PATH = 'data/artists.json';
const STALE_THRESHOLD = 0.10; // <10% of yesterday's count = stale

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
  return new Map(Object.entries(raw).map(([k, v]) => [k, v]));
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
    [...cache.entries()].map(([k, v]) => [k, v.spotifyId])
  );

  const spotify = createSpotifyEnricher({
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  });

  // 1. Fetch all adapters in parallel
  const rawArrays = await Promise.all(
    ADAPTERS.map(([name, ad]) => runAdapter(name, ad))
  );
  const raw = rawArrays.flat();
  console.log(`Total raw events: ${raw.length}`);

  // 2. Normalize + dedupe
  const normalized = raw.map(normalize);
  const deduped = dedupe(normalized);
  console.log(`After dedupe: ${deduped.length}`);

  // 3. Enrich (sequential to be polite to APIs)
  const enriched = [];
  for (const e of deduped) {
    const country = await lookupCountry(e.artist, countryCache);
    const spotifyId = await spotify.lookupId(e.artist, spotifyCache);
    enriched.push({ ...e, country, spotifyId });
  }

  // 4. Filter
  const intl = filterInternational(enriched);
  const within = filterTimeWindow(intl, todayStr());
  within.sort((a, b) => a.date.localeCompare(b.date) || a.artist.localeCompare(b.artist));
  console.log(`Final: ${within.length}`);

  // 5. Stale-data safety net
  const prev = JSON.parse(await readFile(EVENTS_PATH, 'utf8'));
  if (prev.length > 0 && within.length < prev.length * STALE_THRESHOLD) {
    console.error(`STALE: new count ${within.length} < ${STALE_THRESHOLD * 100}% of previous ${prev.length}. Keeping previous.`);
    process.exit(1);
  }

  // 6. Write outputs
  await writeFile(EVENTS_PATH, JSON.stringify(within, null, 2) + '\n');

  // Update artist cache from both lookup caches
  const today = todayStr();
  /** @type {Record<string, import('./types.js').ArtistCacheEntry>} */
  const artistsOut = {};
  for (const e of enriched) {
    const k = e.artist.toLowerCase();
    artistsOut[k] = {
      name: e.artist,
      country: countryCache.get(k) ?? null,
      spotifyId: spotifyCache.get(k) ?? null,
      lookedUpAt: today,
    };
  }
  // Keep older cache entries we didn't see today (don't lose work)
  for (const [k, v] of cache.entries()) {
    if (!artistsOut[k]) artistsOut[k] = v;
  }
  await writeFile(ARTISTS_PATH, JSON.stringify(artistsOut, null, 2) + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run end-to-end (live network)**

Run: `npm run fetch`

Expected: prints per-adapter counts, dedupe count, final count, then writes `data/events.json` and `data/artists.json`. Some adapters may log warnings — that's fine. As long as one source returns events, the run succeeds.

- [ ] **Step 4: Inspect output**

Open `data/events.json`. Confirm it's a non-empty array of objects with the `EnrichedEvent` shape.

- [ ] **Step 5: Commit**

```bash
git add fetcher/index.js data/events.json data/artists.json
git commit -m "feat: orchestrator wiring fetch + normalize + dedupe + enrich + filter"
```

---

## Task 12: Astro page rendering

Single page that reads `data/events.json` at build time and renders chronological list grouped by month, with inline Spotify embed expand-on-click.

**Files:**
- Create: `src/pages/index.astro`, `src/components/MonthHeading.astro`, `src/components/EventRow.astro`, `src/styles/global.css`

- [ ] **Step 1: Create global styles**

```css
/* src/styles/global.css */
:root {
  --bg: #0e0e10;
  --fg: #f5f5f5;
  --dim: #888;
  --accent: #7cf;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--fg); font-family: ui-sans-serif, system-ui, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 2rem 1rem; }
h1 { font-size: 1.5rem; margin: 0 0 1.5rem; }
h2 { font-size: 1rem; color: var(--dim); border-bottom: 1px solid #222; padding-bottom: 0.25rem; margin: 2rem 0 0.75rem; }
.event { display: grid; grid-template-columns: 4.5rem 1fr auto; gap: 0.5rem 1rem; padding: 0.75rem 0; border-bottom: 1px solid #1a1a1a; }
.event.past { opacity: 0.5; }
.date { font-variant-numeric: tabular-nums; color: var(--dim); }
.artist { font-weight: 600; letter-spacing: 0.02em; }
.venue { color: var(--dim); font-size: 0.9rem; }
.actions { display: flex; gap: 0.5rem; align-items: start; }
.actions a, .actions button { background: none; color: var(--accent); border: none; cursor: pointer; font: inherit; padding: 0.25rem 0.5rem; }
.embed { grid-column: 1 / -1; margin-top: 0.5rem; }
.embed iframe { width: 100%; height: 80px; border: 0; border-radius: 8px; }
footer { color: var(--dim); font-size: 0.85rem; margin-top: 3rem; text-align: center; }
```

- [ ] **Step 2: Create `MonthHeading.astro`**

```astro
---
const { label } = Astro.props;
---
<h2>{label}</h2>
```

- [ ] **Step 3: Create `EventRow.astro`**

```astro
---
const { event, today } = Astro.props;
const past = event.date < today;
const flag = countryFlag(event.country);

function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

const dateLabel = formatDate(event.date);
function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
  return `${day} ${String(d.getUTCDate()).padStart(2,'0')}`;
}
---
<div class={`event${past ? ' past' : ''}`} data-event-id={event.id}>
  <div class="date">{dateLabel}</div>
  <div>
    <div class="artist">{event.artist} {flag}</div>
    <div class="venue">{event.venue}{past ? ' (past)' : ''}</div>
  </div>
  <div class="actions">
    {event.spotifyId && (
      <button class="listen" data-spotify-id={event.spotifyId} aria-label="Play preview">▶ listen</button>
    )}
    {event.ticketUrls?.[0] && !past && (
      <a href={event.ticketUrls[0]} target="_blank" rel="noopener">🎟 ticket</a>
    )}
  </div>
</div>
```

- [ ] **Step 4: Create `index.astro`**

```astro
---
import '../styles/global.css';
import MonthHeading from '../components/MonthHeading.astro';
import EventRow from '../components/EventRow.astro';
import events from '../../data/events.json';

const today = new Date().toISOString().slice(0, 10);

const groups = [];
let currentKey = null;
for (const e of events) {
  const key = e.date.slice(0, 7); // YYYY-MM
  if (key !== currentKey) {
    groups.push({ key, label: monthLabel(key), events: [] });
    currentKey = key;
  }
  groups[groups.length - 1].events.push(e);
}

function monthLabel(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  return `${months[m-1]} ${y}`;
}
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>International bands in Buenos Aires</title>
  </head>
  <body>
    <main>
      <h1>International bands in Buenos Aires</h1>
      {groups.map(g => (
        <section>
          <MonthHeading label={g.label} />
          {g.events.map(e => <EventRow event={e} today={today} />)}
        </section>
      ))}
      <footer>
        Updated daily. Sources: Bandsintown, Songkick, Vorterix, Niceto.
      </footer>
    </main>

    <script>
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('button.listen');
        if (!btn) return;
        const row = btn.closest('.event');
        const existing = row.querySelector('.embed');
        if (existing) { existing.remove(); return; }
        const id = btn.getAttribute('data-spotify-id');
        const div = document.createElement('div');
        div.className = 'embed';
        div.innerHTML = `<iframe src="https://open.spotify.com/embed/artist/${id}" allow="encrypted-media"></iframe>`;
        row.appendChild(div);
      });
    </script>
  </body>
</html>
```

- [ ] **Step 5: Run dev server and inspect**

Run: `npm run dev`
Open: `http://localhost:4321`

Expected: page renders the chronological list grouped by month. Past events greyed. Clicking ▶ listen expands a Spotify embed. Clicking it again collapses it.

- [ ] **Step 6: Build static site**

Run: `npm run build`
Expected: `dist/` directory contains `index.html` with the rendered page.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: Astro page rendering chronological event list"
```

---

## Task 13: GitHub Actions daily rebuild

Cron-driven workflow that runs the fetcher, commits the data files if they changed, builds Astro, and deploys to Pages.

**Files:**
- Create: `.github/workflows/daily-rebuild.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/daily-rebuild.yml
name: daily-rebuild

on:
  schedule:
    - cron: '0 9 * * *'   # 09:00 UTC = 06:00 ART
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Fetch events
        env:
          SPOTIFY_CLIENT_ID: ${{ secrets.SPOTIFY_CLIENT_ID }}
          SPOTIFY_CLIENT_SECRET: ${{ secrets.SPOTIFY_CLIENT_SECRET }}
        run: npm run fetch

      - name: Validate events.json
        run: |
          node -e "
            const e = require('./data/events.json');
            if (!Array.isArray(e)) { console.error('not an array'); process.exit(1); }
            for (const x of e) {
              if (!x.id || !x.artist || !x.date || !x.venue) {
                console.error('missing required field', x); process.exit(1);
              }
            }
            console.log('OK', e.length, 'events');
          "

      - name: Commit data changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/events.json data/artists.json
          if git diff --cached --quiet; then
            echo "No data changes"
          else
            git commit -m "chore: daily data refresh ($(date -u +%Y-%m-%d))"
            git push
          fi

      - run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - uses: actions/deploy-pages@v4

  notify-on-stale:
    runs-on: ubuntu-latest
    needs: build-and-deploy
    if: failure()
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Daily rebuild failed (${new Date().toISOString().slice(0,10)})`,
              body: 'Check the workflow run logs. Most likely an adapter broke or the stale-data safety net tripped.',
            });
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/daily-rebuild.yml
git commit -m "ci: daily rebuild workflow with Pages deploy and stale-data alerting"
```

- [ ] **Step 3: Push and configure repo (manual)**

After pushing to GitHub:
1. Repo Settings → Pages → Source = "GitHub Actions"
2. Repo Settings → Secrets and variables → Actions → add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (get from https://developer.spotify.com/dashboard)
3. Trigger the workflow once manually via the Actions tab → "daily-rebuild" → "Run workflow" to verify the full pipeline.

---

## Task 14: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# Bands in Town

Public archive of international bands playing in Buenos Aires, sorted chronologically. Rebuilt daily.

## How it works

A Node fetcher pulls events from multiple sources (Bandsintown, Songkick, venue calendars), dedupes them, looks up each artist's origin country (via MusicBrainz) and Spotify ID, drops Argentine artists, and writes `data/events.json`. Astro reads that JSON at build time and renders a static page deployed to GitHub Pages. Everything happens in a daily GitHub Actions cron job.

## Local development

```bash
nvm use
npm install
npm test                     # run unit tests
SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... npm run fetch   # update data/events.json
npm run dev                  # preview at http://localhost:4321
```

## Adding a new source

1. Capture a fixture: `curl -A "Mozilla/5.0" -L <url> -o tests/fixtures/<name>.html`
2. Write `tests/adapters/<name>.test.js` asserting the parser shape.
3. Implement `fetcher/adapters/<name>.js` exporting `parse(html)` and `fetch()`.
4. Register the adapter in `fetcher/index.js`.
5. `npm test` until green.

## Data files

- `data/events.json` — current event list (rewritten daily; git history is the archive).
- `data/artists.json` — artist metadata cache (origin country, Spotify ID).

## Spec

See `docs/superpowers/specs/2026-05-09-bands-in-town-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Done

At this point: all unit tests pass, `npm run fetch` produces a non-trivial `events.json`, `npm run build` produces a working static site, and the GitHub Actions workflow rebuilds and deploys daily. Future work (Phase 2+ in the spec) is adding more adapters — repeat the Task 10 pattern.
