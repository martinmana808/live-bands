# Bands in Town — Design

**Date:** 2026-05-09
**Status:** Draft for review

## Problem

International touring artists pass through Buenos Aires constantly, but discovery is fragmented across Instagram feeds, ticketing platforms, and venue calendars. Big-name shows (Rolling Stones, Korn) are unmissable; the long tail (a German punk band at Uniclub, Sonata Arctica at Teatro Flores) is invisible unless you happen to follow that specific band. The user has repeatedly missed shows by bands they love because no aggregated, low-friction view exists.

## Goal

A public, read-only website listing every international band playing in Buenos Aires, sorted chronologically. No accounts, no notifications, no app — just a URL that anyone can bookmark and check.

## Non-goals (MVP)

- User accounts, authentication, personalization
- Notifications, email digests, RSS
- Local Argentine artists (international focus is the entire point)
- Historical archive beyond what falls out of the daily rebuild commit history
- Search, filters, tagging — chronological list only; Cmd+F suffices
- Mobile app

## High-level decisions

| Decision | Choice |
|---|---|
| Audience | Public, no accounts |
| Scope | International artists only (filter out `country = AR`) |
| Time window | Future events + last 30 days |
| Per-event info | Date, artist, venue, country flag, ticket link, Spotify inline player |
| Refresh cadence | Daily rebuild (cron) |
| Architecture | Static site, generated daily |
| Stack | Astro + GitHub Actions + GitHub Pages |
| Hosting cost | $0 |

## Architecture

```
┌────────────────────────────────────────────────────┐
│  GitHub Actions (cron: daily 06:00 ART)            │
│    → runs fetcher/                                 │
│    → writes data/events.json + data/artists.json   │
│    → commits + pushes if changed                   │
│    → triggers Astro build + Pages deploy           │
└────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│  Astro site (static)                               │
│    → reads data/events.json at build time          │
│    → renders one chronological page                │
│    → deploys to GitHub Pages                       │
└────────────────────────────────────────────────────┘
```

**Three logical units, separated by a JSON contract:**

- **`fetcher/`** — Node script. Talks to data sources, returns a normalized list of events. Knows nothing about HTML or Astro.
- **`data/events.json`** — the contract between fetcher and site. Committed to the repo so daily commits become a free historical archive.
- **`src/` (Astro)** — reads the JSON, renders the page. Knows nothing about APIs.

## Data sources (multi-source ingestion)

A single source is insufficient. Each source has gaps; the union approaches full coverage.

**Tier 1 — Artist-tracking platforms (broad, structured):**
- Bandsintown city page (`bandsintown.com/c/buenos-aires-argentina`)
- Songkick metro calendar (Buenos Aires metro)

**Tier 2 — Ticketing platforms (closest to ground truth — every show that sells tickets is here):**
- Ticketek Argentina, All Access, Livepass, Passline, Enigma Tickets

**Tier 3 — Venue calendars (long tail):**
- Movistar Arena, Estadio Obras, Vorterix, Niceto Club, Uniclub, C Art Media, Teatro Flores, Gran Rex, Luna Park, Estadio Ferro, Hipódromo de Palermo, Strummer Bar, El Teatrito (~15 venues)

**Tier 4 — Editorial (lower priority, used for context/genre tagging only):**
- Indie Hoy, La Viola, Rolling Stone Argentina

### MVP source set

Ship with **Tier 1 + 2–3 venue adapters from Tier 3** to prove the architecture. Add adapters as coverage gaps appear.

### Adapter interface

Each source is an independent module exporting:

```js
// fetcher/adapters/<name>.js
export async function fetch(): Promise<RawEvent[]>
```

Adding a new source = adding one file. Removing a broken source = deleting one file. **No single point of failure.**

## Pipeline

```
  [Bandsintown] [Songkick] [Ticketek] [Vorterix] [Niceto] ...
        │           │          │          │          │
        ▼           ▼          ▼          ▼          ▼
  ┌───────────────────────────────────────────────────────┐
  │  Normalizer → {artist, date, venue, ticketUrl, ...}   │
  └───────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌───────────────────────────────────────────────────────┐
  │  Deduper                                              │
  │   Match key: normalized_artist + date + venue         │
  │   Fuzzy artist match (Levenshtein) for case/spacing   │
  │   Merge: union of ticket URLs, prefer richest data    │
  └───────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌───────────────────────────────────────────────────────┐
  │  Enricher: MusicBrainz origin lookup (cached)         │
  │  Enricher: Spotify artist ID lookup (cached)          │
  └───────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌───────────────────────────────────────────────────────┐
  │  International filter                                 │
  │   country == AR  → exclude                            │
  │   country == non-AR → include                         │
  │   country unknown → include (long tail bias)          │
  └───────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌───────────────────────────────────────────────────────┐
  │  Time filter (future + last 30 days)                  │
  └───────────────────────────────────────────────────────┘
                            │
                            ▼
                      events.json
```

## Data shapes

### `data/events.json`

```json
[
  {
    "id": "korn-2026-05-14-movistar-arena",
    "artist": "Korn",
    "artistId": "korn",
    "date": "2026-05-14",
    "venue": "Movistar Arena",
    "country": "US",
    "ticketUrls": ["https://allaccess.com.ar/...", "https://ticketek.com.ar/..."],
    "sources": ["bandsintown", "allaccess"]
  }
]
```

### `data/artists.json` (cache)

```json
{
  "korn": {
    "name": "Korn",
    "country": "US",
    "spotifyId": "3RNrq3jvMZxD9ZyoOZbQOD",
    "lookedUpAt": "2026-05-09"
  }
}
```

Both files are committed. `events.json` history is the archive. `artists.json` avoids re-querying MusicBrainz/Spotify daily.

## UX

Single page, chronological, grouped by month:

```
═══════════════════════════════════════════════════════
   International bands in Buenos Aires
═══════════════════════════════════════════════════════

  ── MAY 2026 ────────────────────────────────────────

  Thu 14   KORN                          🇺🇸  ▶ listen
           Movistar Arena                 🎟 ticket

  Sat 23   MANTAR                         🇩🇪  ▶ listen
           Uniclub                        🎟 ticket

  ── SEPTEMBER 2026 ──────────────────────────────────

  Wed 10   HELLOWEEN                      🇩🇪  ▶ listen
           Movistar Arena                 🎟 ticket

  Fri 12   SONATA ARCTICA                 🇫🇮  ▶ listen
           Teatro Flores                  🎟 ticket
```

- Past events (within 30-day window) styled greyed out, marked "(past)"
- Country flag emoji from origin country code
- "▶ listen" expands an inline Spotify embed (top track preview, no login required)
- No filters, no search in MVP
- Mobile-friendly single column
- Footer: "Updated daily • Sources: Bandsintown, Ticketek, …"

## Error handling & resilience

- **Adapter isolation:** each adapter wrapped in try/catch. One failure logs a warning; build continues with remaining adapters.
- **Stale-data safety net:** if all adapters fail, or total event count drops below 10% of yesterday's count, the workflow retains the previous `events.json` and opens a GitHub Issue. Site never goes blank.
- **Enricher failures:** non-fatal. Unknown country → include by default. Missing Spotify ID → no embed, ticket link still shown.
- **Rate limiting:** sequential adapter execution with polite delays. No urgency.
- **Secrets:** Spotify Client Credentials only (one secret). Stored as GitHub Actions secrets. No other source requires auth.

## Testing

- **Adapter tests** — each adapter has a saved HTML/JSON fixture from a real fetch. Test asserts the adapter parses it into the expected `RawEvent[]`. When a site changes layout, the test breaks first and pinpoints the fix.
- **Normalizer / deduper tests** — pure functions. Cover: case/spacing variations ("Korn"/"KoRn"/"KORN"), same band same night via two ticketing platforms, same band on multiple tour dates, venue name variants ("Movistar Arena" vs "Arena Movistar").
- **International-filter tests** — mocked MusicBrainz responses for `AR`, non-AR, and unknown.
- **CI smoke check** — after build, assert `events.json` is valid JSON, has ≥1 event, all required fields present.
- **No e2e browser tests** in MVP. Overkill for a static site.

## Repo layout

```
bands-in-town/
├── .github/workflows/
│   └── daily-rebuild.yml       # cron + build + deploy
├── fetcher/
│   ├── adapters/
│   │   ├── bandsintown.js
│   │   ├── songkick.js
│   │   ├── ticketek.js
│   │   ├── vorterix.js
│   │   └── ...
│   ├── enrichers/
│   │   ├── musicbrainz.js      # origin country
│   │   └── spotify.js          # artist ID for embed
│   ├── normalize.js
│   ├── dedupe.js
│   ├── filter.js
│   └── index.js                # orchestrator
├── data/
│   ├── events.json             # contract — committed
│   └── artists.json            # cache — committed
├── src/                        # Astro
│   ├── pages/index.astro
│   ├── components/EventRow.astro
│   └── styles/...
├── tests/
│   ├── adapters/*.test.js      # with fixtures
│   ├── normalize.test.js
│   └── dedupe.test.js
└── README.md
```

## Risks & open questions

- **Scraping fragility.** Sites change. Mitigation: fixture-based adapter tests, source isolation, stale-data safety net. Expect to fix one adapter every few months.
- **MusicBrainz coverage for tiny acts.** Underground bands may lack MusicBrainz entries. Mitigation: default-include on unknown origin (matches the "discovery long-tail" goal).
- **Bandsintown ToS.** Public city pages are unauthenticated and indexable. Scraping at low volume (one daily fetch) is low-risk but not formally sanctioned. Acceptable for a personal hobby project.
- **Deduplication accuracy.** Cross-source matching on (artist + date + venue) with fuzzy artist matching is a heuristic, not perfect. Expect occasional doubles or missed merges. Tune as needed.

## Phasing

1. **Phase 1 (MVP):** Tier 1 sources (Bandsintown + Songkick) + 2 venue adapters. Full pipeline. Shipped, daily rebuild running.
2. **Phase 2:** Add ticketing platform adapters (Tier 2). This is the biggest coverage win.
3. **Phase 3:** Expand venue adapters until coverage feels complete.
4. **Phase 4 (optional):** Filters, genre tags, archive view.

## Ideas for the future
- After events have happened, a youtube video of the live concert. Or photos. Or a review from someone who was there (found on the web - NOT MADE in this platform)
- Connect your spotify? create playlists? Like artists?
- AND MANY MORE. this will start coming through with usage
