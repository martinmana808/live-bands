import { describe, it, expect } from 'vitest';
import { todayInBuenosAires, TIMEZONE } from '../fetcher/today.js';

describe('todayInBuenosAires', () => {
  it('names the venue city timezone', () => {
    expect(TIMEZONE).toBe('America/Argentina/Buenos_Aires');
  });

  it('returns the local date at midday UTC', () => {
    expect(todayInBuenosAires(new Date('2026-09-05T12:00:00Z'))).toBe('2026-09-05');
  });

  it('is still the previous day late at night in Buenos Aires', () => {
    // 02:45 UTC on the 6th is 23:45 on the 5th in Buenos Aires
    expect(todayInBuenosAires(new Date('2026-09-06T02:45:00Z'))).toBe('2026-09-05');
  });

  it('rolls over at 03:00 UTC', () => {
    expect(todayInBuenosAires(new Date('2026-09-06T03:00:00Z'))).toBe('2026-09-06');
  });

  it('matches UTC at the hour the daily job runs', () => {
    expect(todayInBuenosAires(new Date('2026-09-05T09:00:00Z'))).toBe('2026-09-05');
  });

  it('handles a year boundary', () => {
    expect(todayInBuenosAires(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
  });
});
