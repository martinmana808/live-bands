# Bands in Town

Public archive of international bands playing in Buenos Aires, sorted chronologically. Rebuilt daily.

## How it works

A Node fetcher pulls events from multiple sources (Songkick metro, plus venue calendars for Vorterix and Niceto), cleans the artist names, dedupes them, looks up each artist's origin country (via MusicBrainz) and Spotify ID, drops Argentine artists, and writes `data/events.json`. Astro reads that JSON at build time and renders a static page deployed to GitHub Pages. Everything happens in a daily GitHub Actions cron job.

Two things keep the daily job honest:

- **Adapter health** (`data/health.json`) records how many events each source returned. A source that produced events on its last run and returns none today **fails the build** rather than quietly shrinking the site.
- **`firstSeenAt`** is stamped on every event the first time it is observed and carried forward across rebuilds, which is what makes "newly added shows" possible.

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
- `data/digest-state.json` — when the last digest was sent.

## Spec & plan

- Design: `docs/superpowers/specs/2026-05-09-bands-in-town-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-09-bands-in-town-mvp.md`
