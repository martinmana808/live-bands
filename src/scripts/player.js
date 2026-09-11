const IFRAME_API = 'https://open.spotify.com/embed/iframe-api/v1';

/**
 * Load Spotify's iFrame API once and hand back a controller bound to `host`.
 * Everything Spotify allows without a login goes through this object: load,
 * play, pause, toggle, seek. Skipping tracks does not, which is why next/prev
 * on the bar step between artists rather than between songs.
 *
 * @param {Document} doc
 * @param {HTMLElement} host
 */
function loadSpotifyController(doc, host) {
  const win = doc.defaultView;
  return new Promise((resolve, reject) => {
    const boot = (api) => {
      try {
        api.createController(host, { width: '100%', height: 80, uri: '' }, (controller) => resolve(controller));
      } catch (err) { reject(err); }
    };
    if (win.__spotifyIframeApi) { boot(win.__spotifyIframeApi); return; }
    win.onSpotifyIframeApiReady = (api) => { win.__spotifyIframeApi = api; boot(api); };
    const s = doc.createElement('script');
    s.src = IFRAME_API;
    s.async = true;
    s.onerror = () => reject(new Error('spotify iframe api failed to load'));
    doc.head.append(s);
    win.setTimeout(() => reject(new Error('spotify iframe api timed out')), 15000);
  });
}

/**
 * A single player bar at the bottom of the page. Rows carry a play button;
 * pressing one loads that artist and starts playing straight away.
 *
 * @param {{doc: Document, createController?: (host: HTMLElement) => Promise<any>}} deps
 */
export function createPlayer({ doc, createController }) {
  const bar = doc.getElementById('player');
  const art = doc.getElementById('player-art');
  const name = doc.getElementById('player-name');
  const toggle = doc.getElementById('player-toggle');
  const host = doc.getElementById('player-embed');

  let controller = null;
  let controllerPromise = null;
  let current = null;   // the row's play button currently loaded
  let paused = true;

  const make = createController ?? ((h) => loadSpotifyController(doc, h));

  async function ensureController() {
    if (controller) return controller;
    if (!controllerPromise) {
      controllerPromise = make(host).then((c) => {
        controller = c;
        c.addListener?.('playback_update', (e) => setPaused(Boolean(e?.data?.isPaused)));
        return c;
      });
    }
    return controllerPromise;
  }

  function setPaused(p) {
    paused = p;
    if (toggle) {
      toggle.setAttribute('aria-label', p ? 'Play' : 'Pause');
      toggle.classList.toggle('paused', p);
    }
    if (current) current.closest('.event')?.classList.toggle('paused', p);
  }

  const buttons = () => [...doc.querySelectorAll('button.play[data-spotify-id]')]
    .filter(b => !b.closest('.event')?.hidden);

  async function load(btn) {
    let c;
    try { c = await ensureController(); } catch (err) { console.warn(err.message); return; }

    for (const r of doc.querySelectorAll('.event.playing')) r.classList.remove('playing');
    current = btn;
    btn.closest('.event')?.classList.add('playing');

    if (name) name.textContent = btn.getAttribute('data-artist-name') ?? '';
    if (art) {
      const src = btn.getAttribute('data-artist-image');
      if (src) art.setAttribute('src', src); else art.removeAttribute('src');
    }
    if (bar) bar.hidden = false;

    c.loadUri(`spotify:artist:${btn.getAttribute('data-spotify-id')}`);
    c.play();
    setPaused(false);
  }

  function step(delta) {
    const list = buttons();
    if (list.length === 0) return;
    const i = list.indexOf(current);
    const next = list[(i + delta + list.length) % list.length];
    if (next) load(next);
  }

  function togglePlay() {
    if (!controller || !current) return;
    controller.togglePlay();
    setPaused(!paused);
  }

  function attach() {
    doc.addEventListener('click', (e) => {
      const btn = e.target.closest?.('button.play[data-spotify-id]');
      if (!btn) return;
      if (btn === current) { togglePlay(); return; }
      load(btn);
    });
    toggle?.addEventListener('click', togglePlay);
    doc.getElementById('player-prev')?.addEventListener('click', () => step(-1));
    doc.getElementById('player-next')?.addEventListener('click', () => step(1));
    return api;
  }

  const api = { attach, load, step, togglePlay, get current() { return current; } };
  return api;
}
