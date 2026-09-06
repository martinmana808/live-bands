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

  function smallestImage(images) {
    if (!Array.isArray(images) || images.length === 0) return null;
    let best = images[0];
    for (const img of images) {
      const w = img.width ?? Infinity;
      const bw = best.width ?? Infinity;
      if (w < bw) best = img;
    }
    return best?.url ?? null;
  }

  /**
   * @param {string} artistName
   * @param {Map<string, {id:string,image:string|null}|null>} cache
   * @returns {Promise<{id:string,image:string|null}|null>}
   */
  async function lookup(artistName, cache) {
    const key = artistName.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    // A missing token, a rate limit or a dropped connection is not evidence
    // that the artist has no Spotify page. Leaving the cache alone keeps the
    // lookup retryable instead of freezing a blank thumbnail in for good.
    const tk = await getToken();
    if (!tk) return null;

    try {
      const url = `https://api.spotify.com/v1/search?type=artist&limit=1&q=${encodeURIComponent(artistName)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      if (!res.ok) return null;
      const data = await res.json();
      const item = data?.artists?.items?.[0];
      if (!item) { cache.set(key, null); return null; }
      const result = { id: item.id, image: smallestImage(item.images) };
      cache.set(key, result);
      return result;
    } catch {
      return null;
    }
  }

  return { lookup };
}
