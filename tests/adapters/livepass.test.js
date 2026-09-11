import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse, parseDetailDate, fetchAll } from '../../fetcher/adapters/livepass.js';

const html = readFileSync('tests/fixtures/livepass.html', 'utf8');
const today = '2026-09-11';
const events = parse(html, today);

describe('livepass parse', () => {
  it('finds a substantial number of events', () => {
    expect(events.length).toBeGreaterThan(100);
  });

  it('finds Iron Maiden at Huracán on 20 October', () => {
    const hit = events.find(e => /iron maiden/i.test(e.artist) && e.date === '2026-10-20');
    expect(hit).toBeDefined();
    expect(hit.venue).toMatch(/Huracán/);
  });

  it('emits the second night of a two-day run as its own event', () => {
    expect(events.find(e => /iron maiden/i.test(e.artist) && e.date === '2026-10-21')).toBeDefined();
  });

  it('splits artist from venue on " en "', () => {
    const hit = events.find(e => /iron maiden/i.test(e.artist));
    expect(hit.artist).toBe('IRON MAIDEN');
    expect(hit.venue).toBe('Huracán');
  });

  it('carries an absolute ticket url', () => {
    const hit = events.find(e => /iron maiden/i.test(e.artist));
    expect(hit.ticketUrl).toBe('https://livepass.com.ar/events/iron-maiden-en-huracan');
  });

  it('tags every event with the source', () => {
    expect(events.every(e => e.source === 'livepass')).toBe(true);
  });

  it('produces ISO dates everywhere', () => {
    expect(events.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date))).toBe(true);
  });

  it('does not emit the same show twice from the carousel and the grid', () => {
    const keys = events.map(e => `${e.artist}|${e.date}|${e.venue}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('skips a card with no parseable date', () => {
    const out = parse(`<div class="event-home"><a href="/events/x"><p class="date-home">PRÓXIMAMENTE</p><h1>Someone en Somewhere</h1></a></div>`, today);
    expect(out).toEqual([]);
  });

  it('keeps a title with no " en " as the whole artist and an unknown venue', () => {
    const out = parse(`<div class="event-home"><a href="/events/x"><p class="date-home">12 SEP</p><h1>Festival Cosquín</h1></a></div>`, today);
    expect(out[0].artist).toBe('Festival Cosquín');
    expect(out[0].venue).toBe('Livepass');
  });
});

describe('livepass detail page', () => {
  const detail = readFileSync('tests/fixtures/livepass-detail.html', 'utf8');

  it('reads the date from the structured data on the event page', () => {
    expect(parseDetailDate(detail, today)).toBe('2026-11-29');
  });

  it('falls back to a Spanish date in the copy when there is no structured data', () => {
    expect(parseDetailDate('<p>ANUNCIA SU SHOW 29 DE NOVIEMBRE - ESTADIO</p>', today)).toBe('2026-11-29');
  });

  it('returns null when the page has no date at all', () => {
    expect(parseDetailDate('<p>Próximamente</p>', today)).toBeNull();
  });
});

describe('livepass fetch follows undated cards', () => {
  it('fills in the date of a card the listing left blank', async () => {
    const listing = `<div class="event-home"><a href="/events/ed-sheeran-en-huracan"><p class="date-home"> </p><h1>ED SHEERAN en Huracán</h1></a></div>`;
    const detail = readFileSync('tests/fixtures/livepass-detail.html', 'utf8');
    const fetchImpl = async (url) => url.includes('/events/') ? detail : listing;
    const out = await fetchAll({ fetchImpl, today });
    expect(out).toEqual([{ artist: 'ED SHEERAN', venue: 'Huracán', date: '2026-11-29', ticketUrl: 'https://livepass.com.ar/events/ed-sheeran-en-huracan', source: 'livepass' }]);
  });

  it('does not fetch a detail page for a card that already has a date', async () => {
    const listing = `<div class="event-home"><a href="/events/x"><p class="date-home">12 SEP</p><h1>Someone en Somewhere</h1></a></div>`;
    const calls = [];
    const fetchImpl = async (url) => { calls.push(url); return listing; };
    await fetchAll({ fetchImpl, today });
    expect(calls).toHaveLength(1);
  });

  it('drops an undated card whose detail page also has no date', async () => {
    const listing = `<div class="event-home"><a href="/events/x"><p class="date-home"></p><h1>Someone en Somewhere</h1></a></div>`;
    const fetchImpl = async (url) => url.includes('/events/') ? '<p>Próximamente</p>' : listing;
    expect(await fetchAll({ fetchImpl, today })).toEqual([]);
  });

  it('survives a detail page that fails to load', async () => {
    const listing = `<div class="event-home"><a href="/events/x"><p class="date-home"></p><h1>Someone en Somewhere</h1></a></div>`;
    const fetchImpl = async (url) => { if (url.includes('/events/')) throw new Error('HTTP 500'); return listing; };
    expect(await fetchAll({ fetchImpl, today })).toEqual([]);
  });
});
