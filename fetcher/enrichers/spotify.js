/**
 * @param {{clientId: string, clientSecret: string}} creds
 */
export function createSpotifyEnricher({ clientId, clientSecret }) {
  let token = null;

  async function getToken() {
    if (token) return token;
    if (!clientId || !clientSecret) {
      console.warn(`[spotify] no credentials (id=${!!clientId} secret=${!!clientSecret})`);
      return null;
    }
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        },
        body: 'grant_type=client_credentials',
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`[spotify] token HTTP ${res.status}: ${body.slice(0, 200)}`);
        return null;
      }
      const data = await res.json();
      token = data.access_token;
      return token;
    } catch (err) {
      console.warn(`[spotify] token threw: ${err.message}`);
      return null;
    }
  }

  /**
   * @param {string} artistName
   * @param {Map<string, string|null>} cache
   * @returns {Promise<string|null>}
   */
  async function lookupId(artistName, cache) {
    const key = artistName.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const tk = await getToken();
    if (!tk) {
      cache.set(key, null);
      return null;
    }
    try {
      const url = `https://api.spotify.com/v1/search?type=artist&limit=1&q=${encodeURIComponent(artistName)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      if (!res.ok) { cache.set(key, null); return null; }
      const data = await res.json();
      const id = data?.artists?.items?.[0]?.id ?? null;
      cache.set(key, id);
      return id;
    } catch {
      cache.set(key, null);
      return null;
    }
  }

  return { lookupId };
}
