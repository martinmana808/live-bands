import { describe, it, expect } from 'vitest';
import { fetchHtml, browserHeaders } from '../fetcher/http.js';

const ok = (body = '<html/>') => ({ ok: true, status: 200, text: async () => body });
const fail = (status) => ({ ok: false, status, text: async () => '' });

describe('browserHeaders', () => {
  it('sends a real browser user agent', () => {
    expect(browserHeaders('https://example.com/x')['User-Agent']).toMatch(/Mozilla\/5\.0/);
  });

  it('sends the headers a bot filter looks for beyond the user agent', () => {
    const h = browserHeaders('https://example.com/x');
    expect(h).toHaveProperty('Accept');
    expect(h).toHaveProperty('Accept-Language');
  });

  it('derives a same-origin referer so the request looks like navigation', () => {
    expect(browserHeaders('https://www.allaccess.com.ar/venue/teatro-vorterix').Referer)
      .toBe('https://www.allaccess.com.ar/');
  });
});

describe('fetchHtml', () => {
  it('returns the body on success', async () => {
    const out = await fetchHtml('https://x.test', { fetchImpl: async () => ok('<b>hi</b>') });
    expect(out).toBe('<b>hi</b>');
  });

  it('retries a 403 and succeeds on the second attempt', async () => {
    let calls = 0;
    const fetchImpl = async () => (++calls === 1 ? fail(403) : ok('<b>hi</b>'));
    const out = await fetchHtml('https://x.test', { fetchImpl, delayMs: 0 });
    expect(out).toBe('<b>hi</b>');
    expect(calls).toBe(2);
  });

  it('retries a 429', async () => {
    let calls = 0;
    const fetchImpl = async () => (++calls === 1 ? fail(429) : ok());
    await fetchHtml('https://x.test', { fetchImpl, delayMs: 0 });
    expect(calls).toBe(2);
  });

  it('retries a server error', async () => {
    let calls = 0;
    const fetchImpl = async () => (++calls === 1 ? fail(503) : ok());
    await fetchHtml('https://x.test', { fetchImpl, delayMs: 0 });
    expect(calls).toBe(2);
  });

  it('does not retry a 404', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls++; return fail(404); };
    await expect(fetchHtml('https://x.test', { fetchImpl, delayMs: 0 })).rejects.toThrow(/404/);
    expect(calls).toBe(1);
  });

  it('gives up after the retry budget and reports the status', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls++; return fail(403); };
    await expect(fetchHtml('https://x.test', { fetchImpl, retries: 2, delayMs: 0 }))
      .rejects.toThrow(/403/);
    expect(calls).toBe(3);
  });

  it('retries a thrown network error', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      if (++calls === 1) throw new Error('ECONNRESET');
      return ok('<b>hi</b>');
    };
    expect(await fetchHtml('https://x.test', { fetchImpl, delayMs: 0 })).toBe('<b>hi</b>');
  });
});
