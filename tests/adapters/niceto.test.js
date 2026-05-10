import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../fetcher/adapters/niceto.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../fixtures/niceto.html'), 'utf8');

describe('niceto parser', () => {
  it('returns events with required fields', () => {
    const events = parse(html);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.artist.length).toBeGreaterThan(0);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.venue).toBe('Niceto Club');
      expect(e.source).toBe('niceto');
    }
  });
});
