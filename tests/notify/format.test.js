import { describe, it, expect } from 'vitest';
import { formatDigest } from '../../fetcher/notify/format.js';

const ev = (over = {}) => ({
  id: 'x', artist: 'Slowdive', artistKey: 'slowdive',
  date: '2026-09-12', venue: 'Niceto Club', venueKey: 'niceto',
  ticketUrls: [], sources: [], country: 'GB', spotifyId: null,
  firstSeenAt: '2026-08-01',
  ...over,
});

const digest = (over = {}) => ({
  today: '2026-09-05',
  since: '2026-09-05',
  windowEnd: '2026-09-19',
  fortnight: [],
  newlyAdded: [],
  ...over,
});

const SITE = 'https://martinmana808.github.io/live-bands/';

describe('formatDigest', () => {
  it('renders artist, venue and a readable date for a fortnight show', () => {
    const msg = formatDigest(digest({ fortnight: [ev()] }), { siteUrl: SITE });
    expect(msg).toContain('Slowdive');
    expect(msg).toContain('Niceto Club');
    expect(msg).toContain('Sat 12 Sep');
  });

  it('shows the country flag when the origin is known', () => {
    const msg = formatDigest(digest({ fortnight: [ev({ country: 'GB' })] }), { siteUrl: SITE });
    expect(msg).toContain('\u{1F1EC}\u{1F1E7}');
  });

  it('omits the flag when the origin is unknown', () => {
    const msg = formatDigest(digest({ fortnight: [ev({ country: null })] }), { siteUrl: SITE });
    expect(msg).not.toContain('\u{1F1EC}\u{1F1E7}');
  });

  it('omits the new-shows section when nothing was added', () => {
    const msg = formatDigest(digest({ fortnight: [ev()] }), { siteUrl: SITE });
    expect(msg).not.toMatch(/new show/i);
  });

  it('includes a new-shows section when something was added', () => {
    const msg = formatDigest(digest({ newlyAdded: [ev({ date: '2026-12-18' })] }), { siteUrl: SITE });
    expect(msg).toMatch(/new show/i);
    expect(msg).toContain('Fri 18 Dec');
  });

  it('escapes HTML so a stray ampersand cannot break the message', () => {
    const msg = formatDigest(digest({ fortnight: [ev({ artist: 'Bell & Sebastian <b>' })] }), { siteUrl: SITE });
    expect(msg).toContain('Bell &amp; Sebastian &lt;b&gt;');
    expect(msg).not.toContain('Sebastian <b>');
  });

  it('links back to the site', () => {
    const msg = formatDigest(digest(), { siteUrl: SITE });
    expect(msg).toContain(SITE);
  });

  it('says so plainly when there is nothing at all', () => {
    const msg = formatDigest(digest(), { siteUrl: SITE });
    expect(msg).toMatch(/nothing/i);
  });

  it('truncates a long list and says how many were left out', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      ev({ id: `e${i}`, artist: `Band ${i}`, date: '2026-09-12' }));
    const msg = formatDigest(digest({ fortnight: many }), { siteUrl: SITE, limit: 25 });
    expect(msg).toContain('Band 24');
    expect(msg).not.toContain('Band 25');
    expect(msg).toContain('+5 more');
  });

  it('stays inside the Telegram message size limit for a big digest', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      ev({ id: `e${i}`, artist: `A Very Long Band Name Number ${i}`, date: '2026-09-12' }));
    const msg = formatDigest(digest({ fortnight: many, newlyAdded: many }), { siteUrl: SITE });
    expect(msg.length).toBeLessThan(4096);
  });

  it('links the ticket url when there is one', () => {
    const msg = formatDigest(
      digest({ fortnight: [ev({ ticketUrls: ['https://venti.live/x'] })] }),
      { siteUrl: SITE });
    expect(msg).toContain('https://venti.live/x');
  });
});

describe('formatDigest mentions what it filtered out', () => {
  it('notes unconfirmed shows sitting on the site', () => {
    const msg = formatDigest(
      digest({ fortnight: [ev()], unconfirmedInWindow: 12 }), { siteUrl: SITE });
    expect(msg).toContain('12');
    expect(msg).toMatch(/unconfirmed/i);
  });

  it('says nothing about them when there are none', () => {
    const msg = formatDigest(digest({ fortnight: [ev()], unconfirmedInWindow: 0 }), { siteUrl: SITE });
    expect(msg).not.toMatch(/unconfirmed/i);
  });

  it('still points at the site when the fortnight is empty but unconfirmed shows exist', () => {
    const msg = formatDigest(digest({ unconfirmedInWindow: 7 }), { siteUrl: SITE });
    expect(msg).toMatch(/unconfirmed/i);
  });
});
