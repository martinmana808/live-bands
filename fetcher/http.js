const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const RETRY_STATUS = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

/**
 * Headers that make a scrape look like a browser navigation. Datacenter IPs get
 * a harder look than residential ones, so a bare User-Agent is not enough.
 *
 * @param {string} url
 */
export function browserHeaders(url) {
  const { origin } = new URL(url);
  return {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: `${origin}/`,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * @param {string} url
 * @param {{fetchImpl?: typeof fetch, retries?: number, delayMs?: number}} [opts]
 * @returns {Promise<string>}
 */
export async function fetchHtml(url, opts = {}) {
  const { fetchImpl = globalThis.fetch, retries = 2, delayMs = 1500 } = opts;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(delayMs * attempt);
    try {
      const res = await fetchImpl(url, { headers: browserHeaders(url) });
      if (res.ok) return res.text();
      lastError = new Error(`HTTP ${res.status}`);
      if (!RETRY_STATUS.has(res.status)) throw lastError;
    } catch (err) {
      lastError = err;
      if (/^HTTP \d+$/.test(err.message) && !RETRY_STATUS.has(Number(err.message.slice(5)))) {
        throw err;
      }
    }
  }
  throw lastError;
}
