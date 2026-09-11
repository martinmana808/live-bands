# Bands in Town

Public archive of international bands playing in Buenos Aires, sorted chronologically. Rebuilt daily.

## How it works

A Node fetcher pulls events from multiple sources (Songkick metro, Livepass ticketing, plus venue calendars for Vorterix and Niceto), cleans the artist names, dedupes them, looks up each artist's origin country (via MusicBrainz) and Spotify ID, drops Argentine artists, and writes `data/events.json`. Astro reads that JSON at build time and renders a static page deployed to GitHub Pages. Everything happens in a daily GitHub Actions cron job.

Two things keep the daily job honest:

- **Adapter health** (`data/health.json`) records how many events each source actually returned. A source that produced events on its last run and returns none today opens a `source-down` issue — after the deploy, so one blocked scraper never holds up a good build.
- **Per-source fallback** (`data/sources/*.json`) keeps each source's last successful raw listings. `allaccess.com.ar` (Vorterix) and `nicetoclub.com` both refuse the GitHub runner's datacenter IP while answering a home connection fine, so when a scrape is blocked the site keeps serving that venue's last known shows instead of dropping them. They age out of the time window on their own.
- **`firstSeenAt`** is stamped on every event the first time it is observed, from a ledger
  (`data/first-seen.json`) kept separately from the event list. That separation matters: deriving it
  from the previous `events.json` means a source outage erases the history and every returning show
  looks brand new. The ledger remembers an id for 450 days even while it is missing from the site.

## The page

Search by artist, venue or country code (accent-insensitive), plus filters persisted per
browser: **All**, **Next 14 days**, **New this week**, and **Hidden**. Search composes with
the active filter rather than replacing it. The fortnight window is the same helper the
digest uses (`fetcher/display.js` and `fetcher/digest.js` agree on what 14 days means), so
the page and the notification can never disagree. Events first seen in the last 7 days
carry a `NEW` badge.

The page controller lives in `src/scripts/filters.js` rather than inline in the Astro
component, so it can be driven under jsdom — three composing filters is more than can be
checked by eye. See `tests/filters.test.js`.

### Sharing a show

Every event has a 7-character code (`shortId`), hashed from its stable id so the same show gets
the same code on every rebuild. Share produces `…/live-bands/#e-<code>`; opening it clears any
filter or search that would hide the show, scrolls to it and highlights it.

### Playing an artist

The play button on a row loads that artist into a single bar docked at the bottom and starts
playback at once. Next/previous step between artists in the visible list, not between tracks —
Spotify's iFrame API permits play, pause, toggle and seek without a login, and nothing else.
Playback is 30s previews unless the browser is signed in to Spotify. The controller is in
`src/scripts/player.js`, driven under jsdom with a fake Spotify controller in `tests/player.test.js`.

### Hiding artists you do not care about

The eye icon on a row hides that artist. Hidden artists disappear from every filter and
from search, and the **Hidden** tab lists them all with a click to bring one back.

Hiding works at two levels:

- **In your browser** (`localStorage`) — instant, this device only, does *not* affect the digest.
- **In the repo** (`data/muted.json`) — applies everywhere, including the Telegram digest.
  Entries may be display names or keys; `"Ozuna"` and `"ozuna"` both work.

The **Hidden** tab has a *Copy list* button that yields JSON ready to paste into
`data/muted.json`. Repo-level mutes are tagged `in repo` there, since the browser cannot
lift them — remove them from the file instead.

## Digest

`npm run digest` builds two lists — what is on in the **next fortnight**, and everything **added since the last digest was actually sent** — and pushes them to Telegram.

```bash
npm run digest:dry     # print the message, send nothing
npm run digest         # needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
```

"New" is measured against `data/digest-state.json` (the last send), not against yesterday, so a weekly reader still sees everything that appeared during the week.

### Setting up Telegram

1. Message [@BotFather](https://t.me/BotFather), `/newbot`, copy the token.
2. Send your new bot any message, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `result[0].message.chat.id`.
3. Add repo secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
   (`gh secret set TELEGRAM_BOT_TOKEN`).
4. Optionally set repo variable `DIGEST_DAY` to a three-letter day (`Sat`, default)
   or `daily`. Without the secrets the workflow skips the digest step.

## Local development

```bash
nvm use
npm install
npm test                                         # run unit tests
SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... npm run fetch   # update data/events.json
npm run digest:dry                               # preview the Telegram message
npm run dev                                      # preview at http://localhost:4321
```

## Sources and their quirks

| Source | What it covers | Caveat |
|---|---|---|
| Songkick metro page | Everything, ~2 weeks out | Pagination is blocked at the CDN (`?page=2` → 406), so only page 1 |
| Livepass | Stadium and arena shows months ahead (DF Entertainment) | Undated cards are followed to the event page for their date |
| Vorterix (allaccess) | The venue's own calendar | 403s the GitHub runner; served from the last good fetch |
| Niceto Club | The venue's own calendar | Intermittently empty from the runner |

Movistar Arena's own site is a Blazor app over WebSockets and cannot be scraped; its shows appear
only when Songkick's first page happens to list them.

## Adding a new source

1. Capture a fixture: `curl -A "Mozilla/5.0" -L <url> -o tests/fixtures/<name>.html`
2. Write `tests/adapters/<name>.test.js` asserting the parser shape.
3. Implement `fetcher/adapters/<name>.js` exporting `parse(html)` and `fetch()`.
4. Register the adapter in `fetcher/index.js` (add to the `ADAPTERS` array).
5. `npm test` until green.

## Data files

- `data/events.json` — current event list (rewritten daily; git history is the archive).
- `data/artists.json` — artist metadata cache (origin country, Spotify ID). Countries carry a
  `countryResolvedBy` stamp; bump `COUNTRY_RESOLVER` in `fetcher/cache.js` to force a re-lookup
  after changing the matching rules.
- `data/health.json` — per-adapter event counts and the last date each source worked.
- `data/sources/<name>.json` — last successful raw fetch per source, used as a fallback when a
  scrape is blocked, for up to 14 days. Refresh them from a machine that can reach the sites
  (`npm run fetch`).
- `data/first-seen.json` — event id to the date it was first observed. Survives a source outage.
- `data/digest-state.json` — when the last digest was sent.

## Spec & plan

- Design: `docs/superpowers/specs/2026-05-09-bands-in-town-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-09-bands-in-town-mvp.md`
