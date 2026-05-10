import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../fetcher/adapters/songkick.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../fixtures/songkick-buenos-aires.html'), 'utf8');

describe('songkick parser', () => {
  it('returns events', () => {
    expect(parse(html).length).toBeGreaterThan(0);
  });
  it('every event has artist, date, venue, source=songkick', () => {
    for (const e of parse(html)) {
      expect(e.artist.length).toBeGreaterThan(0);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.venue.length).toBeGreaterThan(0);
      expect(e.source).toBe('songkick');
    }
  });
});
