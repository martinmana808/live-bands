import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseListing, parseDetail, fetchAll, DETAIL_TTL_DAYS } from '../../fetcher/adapters/tuentrada.js';

const listing = readFileSync('tests/fixtures/tuentrada.html', 'utf8');
const detail = readFileSync('tests/fixtures/tuentrada-detail.html', 'utf8');
const today = '2026-09-12';

describe('tuentrada parseListing', () => {
  const tiles = parseListing(listing);

  it('finds a substantial number of distinct events', () => {
    expect(tiles.length).toBeGreaterThan(15);
  });

  it('returns a slug and a name per tile', () => {
    const t = tiles.find(t => t.slug === 'alex-anwandter-tgr');
    expect(t).toEqual({ slug: 'alex-anwandter-tgr', name: 'Alex Anwandter' });
  });

  it('does not repeat a slug', () => {
    const slugs = tiles.map(t => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('ignores links to other hosts', () => {
    expect(tiles.some(t => t.slug.includes('://'))).toBe(false);
  });
});

describe('tuentrada parseDetail', () => {
  const sessions = parseDetail(detail);

  it('reads every session with an ISO date', () => {
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toEqual({ date: '2026-09-18', venue: 'Teatro Gran Rex', city: 'Buenos Aires', name: 'Alex Anwandter' });
  });

  it('returns nothing for a page with no sessions', () => {
    expect(parseDetail('<html><body>nope</body></html>')).toEqual([]);
  });

  it('emits one entry per session of a multi-date run', () => {
    const page = `self.__next_f.push([1,"x\\"eventSessions\\":[{\\"date\\":\\"2026-10-20T21:00:00-03:00\\",\\"venue\\":\\"Luna Park\\",\\"city\\":\\"Buenos Aires\\",\\"name\\":\\"Someone\\"},{\\"date\\":\\"2026-10-21T21:00:00-03:00\\",\\"venue\\":\\"Luna Park\\",\\"city\\":\\"Buenos Aires\\",\\"name\\":\\"Someone\\"}]y"])`;
    expect(parseDetail(page).map(s => s.date)).toEqual(['2026-10-20', '2026-10-21']);
  });
});

describe('tuentrada fetchAll', () => {
  const twoTiles = `self.__next_f.push([1,"{\\"alt\\":\\"Alex Anwandter\\",\\"href\\":\\"alex-anwandter-tgr\\"},{\\"alt\\":\\"Someone Else\\",\\"href\\":\\"someone-else\\"}"])`;
  const detailFor = (name, date, venue = 'Luna Park', city = 'Buenos Aires') =>
    `self.__next_f.push([1,"\\"eventSessions\\":[{\\"date\\":\\"${date}T21:00:00-03:00\\",\\"venue\\":\\"${venue}\\",\\"city\\":\\"${city}\\",\\"name\\":\\"${name}\\"}]"])`;

  it('follows every tile to its sessions', async () => {
    const fetchImpl = async (url) => {
      if (url.endsWith('/alex-anwandter-tgr')) return detailFor('Alex Anwandter', '2026-09-18', 'Teatro Gran Rex');
      if (url.endsWith('/someone-else')) return detailFor('Someone Else', '2026-10-01');
      return twoTiles;
    };
    const { events } = await fetchAll({ fetchImpl, cache: {}, today });
    expect(events).toEqual([
      { artist: 'Alex Anwandter', venue: 'Teatro Gran Rex', date: '2026-09-18', ticketUrl: 'https://www.tuentrada.com/alex-anwandter-tgr', source: 'tuentrada' },
      { artist: 'Someone Else', venue: 'Luna Park', date: '2026-10-01', ticketUrl: 'https://www.tuentrada.com/someone-else', source: 'tuentrada' },
    ]);
  });

  it('serves a slug from the cache without fetching its page', async () => {
    const calls = [];
    const fetchImpl = async (url) => { calls.push(url); return url.endsWith('.com/') ? twoTiles : detailFor('x', '2026-10-01'); };
    const cache = {
      'alex-anwandter-tgr': { fetchedAt: today, sessions: [{ date: '2026-09-18', venue: 'Teatro Gran Rex', city: 'Buenos Aires', name: 'Alex Anwandter' }] },
      'someone-else': { fetchedAt: today, sessions: [{ date: '2026-10-01', venue: 'Luna Park', city: 'Buenos Aires', name: 'Someone Else' }] },
    };
    const { events } = await fetchAll({ fetchImpl, cache, today });
    expect(calls).toHaveLength(1);
    expect(events).toHaveLength(2);
  });

  it('refetches a cached slug once it goes stale, since sessions get added', async () => {
    const calls = [];
    const fetchImpl = async (url) => { calls.push(url); return url.endsWith('.com/') ? twoTiles : detailFor('x', '2026-10-01'); };
    const stale = { fetchedAt: '2026-08-01', sessions: [] };
    await fetchAll({ fetchImpl, cache: { 'alex-anwandter-tgr': stale, 'someone-else': stale }, today });
    expect(calls).toHaveLength(3);
  });

  it('returns the updated cache for persisting', async () => {
    const fetchImpl = async (url) => url.endsWith('.com/') ? twoTiles : detailFor('x', '2026-10-01');
    const { cache } = await fetchAll({ fetchImpl, cache: {}, today });
    expect(cache['alex-anwandter-tgr'].fetchedAt).toBe(today);
    expect(cache['alex-anwandter-tgr'].sessions).toHaveLength(1);
  });

  it('forgets slugs that are no longer listed', async () => {
    const fetchImpl = async (url) => url.endsWith('.com/') ? twoTiles : detailFor('x', '2026-10-01');
    const { cache } = await fetchAll({ fetchImpl, cache: { gone: { fetchedAt: today, sessions: [] } }, today });
    expect(cache.gone).toBeUndefined();
  });

  it('keeps sessions outside Buenos Aires out', async () => {
    const fetchImpl = async (url) => url.endsWith('.com/') ? twoTiles : detailFor('x', '2026-10-01', 'Estadio', 'Córdoba');
    const { events } = await fetchAll({ fetchImpl, cache: {}, today });
    expect(events).toEqual([]);
  });

  it('survives a detail page that fails, keeping the old cache entry', async () => {
    const fetchImpl = async (url) => { if (url.endsWith('.com/')) return twoTiles; throw new Error('HTTP 500'); };
    const prior = { fetchedAt: '2026-08-01', sessions: [{ date: '2026-09-18', venue: 'V', city: 'Buenos Aires', name: 'Alex Anwandter' }] };
    const { events, cache } = await fetchAll({ fetchImpl, cache: { 'alex-anwandter-tgr': prior }, today });
    expect(cache['alex-anwandter-tgr']).toEqual(prior);
    expect(events).toHaveLength(1);
  });

  it('uses a two week ttl on details', () => {
    expect(DETAIL_TTL_DAYS).toBe(14);
  });
});
