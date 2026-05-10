# Bands in Town

Public archive of international bands playing in Buenos Aires, sorted chronologically. Rebuilt daily.

## How it works

A Node fetcher pulls events from multiple sources (Songkick metro, plus venue calendars for Vorterix and Niceto), dedupes them, looks up each artist's origin country (via MusicBrainz) and Spotify ID, drops Argentine artists, and writes `data/events.json`. Astro reads that JSON at build time and renders a static page deployed to GitHub Pages. Everything happens in a daily GitHub Actions cron job.

## Local development

```bash
nvm use
npm install
npm test                                         # run unit tests
SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... npm run fetch   # update data/events.json
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
- `data/artists.json` — artist metadata cache (origin country, Spotify ID).

## Spec & plan

- Design: `docs/superpowers/specs/2026-05-09-bands-in-town-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-09-bands-in-town-mvp.md`
