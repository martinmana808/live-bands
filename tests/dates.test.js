import { describe, it, expect } from 'vitest';
import { parseSpanishDate } from '../fetcher/dates.js';

const today = '2026-09-05';

describe('parseSpanishDate', () => {
  it('passes an ISO date straight through', () => {
    expect(parseSpanishDate('2026-12-18', today)).toBe('2026-12-18');
  });

  it('parses "18 de diciembre"', () => {
    expect(parseSpanishDate('18 de diciembre', today)).toBe('2026-12-18');
  });

  it('parses the "JUEVES 7 MAYO" form with no "de"', () => {
    expect(parseSpanishDate('JUEVES 7 MAYO', '2026-04-01')).toBe('2026-05-07');
  });

  it('honours an explicit year over any inference', () => {
    expect(parseSpanishDate('14 de enero de 2028', today)).toBe('2028-01-14');
  });

  it('rolls a bare month that has already passed into next year', () => {
    expect(parseSpanishDate('14 de enero', today)).toBe('2027-01-14');
  });

  it('keeps a bare date from earlier this month in the current year', () => {
    expect(parseSpanishDate('1 de septiembre', today)).toBe('2026-09-01');
  });

  it('keeps a recent past date in the current year rather than rolling it', () => {
    expect(parseSpanishDate('20 de agosto', today)).toBe('2026-08-20');
  });

  it('rolls over correctly when today is late in the year', () => {
    expect(parseSpanishDate('5 de febrero', '2026-12-20')).toBe('2027-02-05');
  });

  it('pads single digit days', () => {
    expect(parseSpanishDate('7 de octubre', today)).toBe('2026-10-07');
  });

  it('returns null for text with no date', () => {
    expect(parseSpanishDate('POGOFEST ESPECIAL METAL', today)).toBeNull();
  });

  it('returns null for an unknown month name', () => {
    expect(parseSpanishDate('14 de smarch', today)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseSpanishDate('', today)).toBeNull();
  });
});
