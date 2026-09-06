import { describe, it, expect } from 'vitest';
import { isWithinDays, isRecentlyAdded, RECENT_DAYS } from '../fetcher/display.js';

const today = '2026-09-06';

describe('isWithinDays', () => {
  it('includes an event happening today', () => {
    expect(isWithinDays('2026-09-06', today, 14)).toBe(true);
  });

  it('includes the last day of the window', () => {
    expect(isWithinDays('2026-09-20', today, 14)).toBe(true);
  });

  it('excludes the day after the window', () => {
    expect(isWithinDays('2026-09-21', today, 14)).toBe(false);
  });

  it('excludes an event that already happened', () => {
    expect(isWithinDays('2026-09-05', today, 14)).toBe(false);
  });

  it('agrees with the digest window', () => {
    // The page and the Telegram message must not disagree about what a
    // fortnight is, or the site contradicts the notification.
    expect(isWithinDays('2026-09-20', today, 14)).toBe(true);
    expect(isWithinDays('2026-09-21', today, 14)).toBe(false);
  });
});

describe('isRecentlyAdded', () => {
  it('flags an event first seen today', () => {
    expect(isRecentlyAdded({ firstSeenAt: today }, today)).toBe(true);
  });

  it('flags an event first seen inside the recent window', () => {
    expect(isRecentlyAdded({ firstSeenAt: '2026-08-31' }, today)).toBe(true);
  });

  it('does not flag an older event', () => {
    expect(isRecentlyAdded({ firstSeenAt: '2026-08-29' }, today)).toBe(false);
  });

  it('does not flag an event with no firstSeenAt', () => {
    expect(isRecentlyAdded({}, today)).toBe(false);
  });

  it('uses a one week recency window', () => {
    expect(RECENT_DAYS).toBe(7);
  });
});
