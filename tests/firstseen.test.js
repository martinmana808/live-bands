import { describe, it, expect } from 'vitest';
import { applyFirstSeen, seedLedger, LEDGER_TTL_DAYS } from '../fetcher/firstseen.js';

const ev = (over = {}) => ({
  id: 'x', artist: 'X', artistKey: 'x',
  date: '2026-09-20', venue: 'V', venueKey: 'v',
  ticketUrls: [], sources: [], country: null, spotifyId: null,
  ...over,
});

const today = '2026-09-06';

describe('applyFirstSeen', () => {
  it('stamps today on an event never seen before', () => {
    const { events } = applyFirstSeen([ev({ id: 'new' })], {}, today);
    expect(events[0].firstSeenAt).toBe(today);
  });

  it('records a newly seen event in the ledger', () => {
    const { ledger } = applyFirstSeen([ev({ id: 'new' })], {}, today);
    expect(ledger.new).toBe(today);
  });

  it('carries forward the original date for an event already in the ledger', () => {
    const { events } = applyFirstSeen([ev({ id: 'known' })], { known: '2026-08-01' }, today);
    expect(events[0].firstSeenAt).toBe('2026-08-01');
  });

  it('leaves every other field untouched', () => {
    const { events } = applyFirstSeen([ev({ id: 'a', artist: 'Slowdive' })], {}, today);
    expect(events[0].artist).toBe('Slowdive');
    expect(events[0].date).toBe('2026-09-20');
  });

  it('does not mutate the ledger it was given', () => {
    const ledger = { known: '2026-08-01' };
    applyFirstSeen([ev({ id: 'new' })], ledger, today);
    expect(ledger).toEqual({ known: '2026-08-01' });
  });
});

describe('applyFirstSeen survives a source outage', () => {
  it('remembers an event that is missing from this run', () => {
    const { ledger } = applyFirstSeen([ev({ id: 'present' })], { vanished: '2026-08-01' }, today);
    expect(ledger.vanished).toBe('2026-08-01');
  });

  it('gives a returning event its original date back, not today', () => {
    // Regression: a blocked scraper dropped 37 Vorterix shows for one run, and
    // they all came back stamped as brand new the next day.
    const outage = applyFirstSeen([], { vorterix1: '2026-08-01' }, '2026-09-05');
    const back = applyFirstSeen([ev({ id: 'vorterix1' })], outage.ledger, today);
    expect(back.events[0].firstSeenAt).toBe('2026-08-01');
  });
});

describe('applyFirstSeen ledger housekeeping', () => {
  it('drops an entry older than the retention window', () => {
    const stale = { ancient: '2025-01-01' };
    const { ledger } = applyFirstSeen([], stale, today);
    expect(ledger.ancient).toBeUndefined();
  });

  it('keeps an entry inside the retention window', () => {
    const { ledger } = applyFirstSeen([], { recent: '2026-06-01' }, today);
    expect(ledger.recent).toBe('2026-06-01');
  });

  it('retains entries for well over a year of lead time', () => {
    expect(LEDGER_TTL_DAYS).toBeGreaterThanOrEqual(400);
  });
});

describe('seedLedger', () => {
  it('builds a ledger from events that already carry firstSeenAt', () => {
    expect(seedLedger([ev({ id: 'a', firstSeenAt: '2026-08-01' })])).toEqual({ a: '2026-08-01' });
  });

  it('ignores events with no firstSeenAt', () => {
    expect(seedLedger([ev({ id: 'a' })])).toEqual({});
  });

  it('keeps the earliest date when an id appears twice', () => {
    expect(seedLedger([
      ev({ id: 'a', firstSeenAt: '2026-08-05' }),
      ev({ id: 'a', firstSeenAt: '2026-08-01' }),
    ])).toEqual({ a: '2026-08-01' });
  });
});
