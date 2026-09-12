import { fold } from '../../fetcher/search.js';

const FILTER_KEY = 'bit:filter';
const MUTE_KEY = 'bit:muted';
const GENRE_KEY = 'bit:genre';

const key = (s) => fold(s).replace(/ /g, '');

/**
 * The page's filter/search/mute controller.
 *
 * Takes its document and storage as arguments so the whole thing can be driven
 * under jsdom - this is the one part of the project a user interacts with
 * directly, and three composing filters is more than can be checked by eye.
 *
 * @param {{doc: Document, storage: Storage, committedMuted?: string[], animate?: boolean}} deps
 */
export function createApp({ doc, storage, committedMuted, animate = true }) {
  const win = doc.defaultView;
  const LEAVE_MS = 400;

  const reducedMotion = () => {
    try { return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
  };

  /**
   * Collapse a row before it is hidden, so the rows below slide up to fill the
   * gap instead of jumping. Height is animated from its measured value so the
   * CSS does not need to guess how tall a row is.
   */
  function leave(row, done) {
    if (!animate || !win || reducedMotion()) { done(); return; }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      row.classList.remove('leaving');
      row.style.height = '';
      done();
    };
    row.style.height = `${row.offsetHeight}px`;
    row.classList.add('leaving');
    const raf = win.requestAnimationFrame ?? ((fn) => win.setTimeout(fn, 0));
    raf(() => { row.style.height = '0px'; });
    row.addEventListener('transitionend', finish, { once: true });
    win.setTimeout(finish, LEAVE_MS);
  }

  const read = (k, fallback) => {
    try { return JSON.parse(storage.getItem(k)) ?? fallback; } catch { return fallback; }
  };
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch {} };

  const committed = committedMuted
    ?? JSON.parse(doc.getElementById('committed-muted')?.textContent || '[]');

  let filter = 'all';
  let query = '';
  let genre = '';
  // Committed mutes apply everywhere including the digest; browser mutes are
  // only this device, which is why the Hidden panel distinguishes them.
  let localMuted = read(MUTE_KEY, []);

  const mutedSet = () => new Set([...committed, ...localMuted].map(key).filter(Boolean));

  const matches = (row, words) => {
    if (words.length === 0) return true;
    const hay = fold(row.getAttribute('data-search'));
    return words.every(w => hay.includes(w));
  };

  function renderMutedList() {
    const muted = mutedSet();
    const names = new Map();
    for (const b of doc.querySelectorAll('[data-mute-key]')) {
      const k = b.getAttribute('data-mute-key');
      if (muted.has(k)) names.set(k, b.getAttribute('data-mute-name'));
    }
    // An artist can be muted with no current listing to read a name from.
    for (const k of muted) if (!names.has(k)) names.set(k, k);

    const ul = doc.getElementById('muted-list');
    if (!ul) return;

    if (names.size === 0) {
      const li = doc.createElement('li');
      li.textContent = 'Nothing hidden.';
      ul.replaceChildren(li);
      return;
    }

    const committedKeys = new Set(committed.map(key));
    ul.replaceChildren(...[...names.entries()]
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .map(([k, name]) => {
        const li = doc.createElement('li');
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'unmute';
        btn.textContent = name;
        btn.title = `Show ${name} again`;
        btn.setAttribute('data-unmute-key', k);
        btn.addEventListener('click', () => unmute(k));
        li.append(btn);
        if (committedKeys.has(k)) {
          const tag = doc.createElement('span');
          tag.className = 'tag';
          tag.textContent = 'in repo';
          tag.title = 'Muted in data/muted.json — remove it there to bring this back everywhere';
          li.append(tag);
        }
        return li;
      }));
  }

  function render() {
    const muted = mutedSet();
    const words = fold(query).split(' ').filter(Boolean);
    let shown = 0;

    for (const row of doc.querySelectorAll('.event')) {
      const isMuted = muted.has(row.getAttribute('data-artist-key'));
      const country = row.getAttribute('data-country') ?? '';
      const inFilter = filter === 'all'
        || (filter === 'fortnight' && row.hasAttribute('data-fortnight'))
        || (filter === 'new' && row.hasAttribute('data-recent'))
        || (filter === 'intl' && country !== '' && country !== 'AR');
      const inGenre = !genre
        || (row.getAttribute('data-genres') ?? '').split(' ').includes(genre);
      // The Hidden view is the one place muted rows are meant to be visible.
      const ok = filter === 'muted'
        ? isMuted && matches(row, words)
        : inFilter && inGenre && !isMuted && matches(row, words);
      row.hidden = !ok;
      if (ok) shown++;
    }

    for (const sec of doc.querySelectorAll('main section:not(#muted-panel)')) {
      sec.hidden = ![...sec.querySelectorAll('.event')].some(r => !r.hidden);
    }

    for (const b of doc.querySelectorAll('button.filter')) {
      const on = b.getAttribute('data-filter') === filter;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }

    for (const b of doc.querySelectorAll('button.genre')) {
      const on = b.getAttribute('data-genre') === genre;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }

    const mutedBtn = doc.querySelector('.muted-filter');
    if (mutedBtn) {
      mutedBtn.hidden = muted.size === 0;
      const c = mutedBtn.querySelector('.count');
      if (c) c.textContent = String(muted.size);
    }

    const panel = doc.getElementById('muted-panel');
    if (panel) panel.hidden = filter !== 'muted';
    if (filter === 'muted') renderMutedList();

    const rc = doc.querySelector('.result-count');
    if (rc) {
      rc.hidden = !(query || genre || filter !== 'all');
      rc.textContent = `${shown} ${shown === 1 ? 'show' : 'shows'}`;
    }
    const empty = doc.querySelector('p.empty');
    if (empty) empty.hidden = shown > 0;
    const clear = doc.getElementById('q-clear');
    if (clear) clear.hidden = query === '';

    return shown;
  }

  function mute(k) {
    if (!k) return;
    if (!localMuted.map(key).includes(k)) localMuted.push(k);
    write(MUTE_KEY, localMuted);

    const rows = [...doc.querySelectorAll(`.event[data-artist-key="${k}"]`)].filter(r => !r.hidden);
    if (rows.length === 0) { render(); return; }
    let pending = rows.length;
    for (const row of rows) leave(row, () => { if (--pending === 0) render(); });
  }

  function unmute(k) {
    localMuted = localMuted.filter(m => key(m) !== k);
    write(MUTE_KEY, localMuted);
    // Leaving the empty Hidden view up with no explanation is disorienting.
    if (filter === 'muted' && mutedSet().size === 0) setFilter('all');
    else render();
  }

  function setFilter(name) {
    filter = name;
    write(FILTER_KEY, name);
    render();
  }

  function setQuery(value) {
    query = value;
    render();
  }

  /**
   * Land on one event from a shared link. Whatever would hide it - a saved
   * filter, a genre chip, a search - is cleared first, otherwise the link
   * opens onto a list with the show nowhere in sight.
   */
  function reveal(shortId) {
    if (!shortId) return;
    const row = doc.querySelector(`.event[data-short-id="${shortId}"]`);
    if (!row) return;
    render();
    if (row.hidden) {
      filter = 'all';
      query = '';
      genre = '';
      const q = doc.getElementById('q');
      if (q) q.value = '';
      render();
    }
    for (const r of doc.querySelectorAll('.event.target')) r.classList.remove('target');
    row.classList.add('target');
    row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  function setGenre(name) {
    genre = name === genre ? '' : (name ?? '');
    write(GENRE_KEY, genre);
    render();
  }

  function attach() {
    for (const btn of doc.querySelectorAll('button.filter')) {
      btn.addEventListener('click', () => setFilter(btn.getAttribute('data-filter')));
    }

    for (const btn of doc.querySelectorAll('button.genre')) {
      btn.addEventListener('click', () => setGenre(btn.getAttribute('data-genre')));
    }

    const q = doc.getElementById('q');
    if (q) {
      q.addEventListener('input', () => setQuery(q.value));
      q.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { q.value = ''; setQuery(''); }
      });
    }
    const clear = doc.getElementById('q-clear');
    if (clear && q) {
      clear.addEventListener('click', () => { q.value = ''; setQuery(''); q.focus(); });
    }

    doc.addEventListener('click', (e) => {
      const btn = e.target.closest?.('button.mute[data-mute-key]');
      if (btn) mute(btn.getAttribute('data-mute-key'));
    });

    const copy = doc.getElementById('muted-copy');
    if (copy) {
      copy.addEventListener('click', async () => {
        try {
          await doc.defaultView.navigator.clipboard.writeText(
            JSON.stringify([...mutedSet()].sort(), null, 2));
          copy.textContent = 'Copied';
          doc.defaultView.setTimeout(() => { copy.textContent = 'Copy list'; }, 1200);
        } catch {}
      });
    }

    const saved = read(FILTER_KEY, 'all');
    if (typeof saved === 'string') filter = saved;
    const savedGenre = read(GENRE_KEY, '');
    if (typeof savedGenre === 'string') genre = savedGenre;

    const hash = doc.defaultView?.location?.hash ?? '';
    const m = hash.match(/^#e-([a-z0-9]+)$/);
    if (m) reveal(m[1]);
    doc.defaultView?.addEventListener?.('hashchange', () => {
      const h = doc.defaultView.location.hash.match(/^#e-([a-z0-9]+)$/);
      if (h) reveal(h[1]);
    });
    return api;
  }

  const api = {
    render, attach, mute, unmute, setFilter, setQuery, setGenre, reveal,
    get filter() { return filter; },
    get genre() { return genre; },
    get muted() { return [...mutedSet()]; },
  };
  return api;
}
