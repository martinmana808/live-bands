import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createApp } from '../src/scripts/filters.js';

const row = ({ key, artist, venue, country = '', fortnight = false, recent = false, families = '' }) => `
  <div class="event" id="e-${key}" data-short-id="${key}" data-artist-key="${key}" data-search="${artist} ${venue} ${country}" data-genres="${families}"
       ${fortnight ? 'data-fortnight' : ''} ${recent ? 'data-recent' : ''}>
    <div class="artist">${artist}</div>
    <button class="mute" data-mute-key="${key}" data-mute-name="${artist}">hide</button>
  </div>`;

const PAGE = `<main>
  <input id="q" /><button id="q-clear"></button>
  <nav>
    <button class="filter" data-filter="all"><span class="count"></span></button>
    <button class="filter" data-filter="fortnight"><span class="count"></span></button>
    <button class="filter" data-filter="new"><span class="count"></span></button>
    <button class="filter muted-filter" data-filter="muted"><span class="count"></span></button>
  </nav>
  <nav class="genres-nav">
    <button class="genre" data-genre="rock"></button>
    <button class="genre" data-genre="latin"></button>
  </nav>
  <p class="result-count"></p>
  <section id="muted-panel"><ul id="muted-list"></ul><button id="muted-copy">Copy list</button></section>
  <p class="empty"></p>
  <section id="sep">
    ${row({ key: 'ozuna', artist: 'Ozuna', venue: 'Movistar Arena', country: 'PR', fortnight: true, recent: true, families: 'latin pop' })}
    ${row({ key: 'cafetacvba', artist: 'Café Tacvba', venue: 'Niceto Club', country: 'MX', fortnight: true, families: 'rock latin' })}
  </section>
  <section id="oct">
    ${row({ key: 'caifanes', artist: 'CAIFANES', venue: 'Vorterix', country: 'MX' })}
  </section>
</main>`;

let dom, doc, storage, app;

const setup = (committedMuted = []) => {
  dom = new JSDOM(`<!doctype html><html><body>${PAGE}</body></html>`);
  doc = dom.window.document;
  const store = new Map();
  storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  app = createApp({ doc, storage, committedMuted, animate: false });
  app.attach();
  app.render();
};

const visible = () => [...doc.querySelectorAll('.event')].filter(r => !r.hidden)
  .map(r => r.querySelector('.artist').textContent.trim());

beforeEach(() => setup());

describe('filters', () => {
  it('shows everything by default', () => {
    expect(visible()).toEqual(['Ozuna', 'Café Tacvba', 'CAIFANES']);
  });

  it('narrows to the fortnight', () => {
    app.setFilter('fortnight');
    expect(visible()).toEqual(['Ozuna', 'Café Tacvba']);
  });

  it('narrows to newly added', () => {
    app.setFilter('new');
    expect(visible()).toEqual(['Ozuna']);
  });

  it('hides a month section once all its shows are filtered out', () => {
    app.setFilter('new');
    expect(doc.getElementById('oct').hidden).toBe(true);
    expect(doc.getElementById('sep').hidden).toBe(false);
  });

  it('marks the active filter for assistive tech', () => {
    app.setFilter('fortnight');
    const btn = doc.querySelector('[data-filter="fortnight"]');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(doc.querySelector('[data-filter="all"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('remembers the filter across a reload', () => {
    app.setFilter('fortnight');
    const app2 = createApp({ doc, storage, animate: false }).attach();
    app2.render();
    expect(app2.filter).toBe('fortnight');
  });
});

describe('search', () => {
  it('matches part of an artist name', () => {
    app.setQuery('ozu');
    expect(visible()).toEqual(['Ozuna']);
  });

  it('matches a venue', () => {
    app.setQuery('niceto');
    expect(visible()).toEqual(['Café Tacvba']);
  });

  it('ignores accents', () => {
    app.setQuery('cafe');
    expect(visible()).toEqual(['Café Tacvba']);
  });

  it('matches a country code', () => {
    app.setQuery('mx');
    expect(visible()).toEqual(['Café Tacvba', 'CAIFANES']);
  });

  it('combines with the active filter rather than replacing it', () => {
    app.setFilter('fortnight');
    app.setQuery('mx');
    expect(visible()).toEqual(['Café Tacvba']);
  });

  it('shows the empty message when nothing matches', () => {
    app.setQuery('slowdive');
    expect(visible()).toEqual([]);
    expect(doc.querySelector('p.empty').hidden).toBe(false);
  });

  it('reports how many shows matched', () => {
    app.setQuery('mx');
    expect(doc.querySelector('.result-count').textContent).toBe('2 shows');
  });

  it('uses the singular for one result', () => {
    app.setQuery('ozuna');
    expect(doc.querySelector('.result-count').textContent).toBe('1 show');
  });

  it('clears from the input event', () => {
    const q = doc.getElementById('q');
    q.value = 'ozuna';
    q.dispatchEvent(new dom.window.Event('input'));
    expect(visible()).toEqual(['Ozuna']);
    doc.getElementById('q-clear').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(visible()).toHaveLength(3);
  });
});

describe('muting', () => {
  it('hides an artist when its row button is clicked', () => {
    doc.querySelector('button.mute[data-mute-key="ozuna"]')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(visible()).toEqual(['Café Tacvba', 'CAIFANES']);
  });

  it('keeps the artist hidden across a reload', () => {
    app.mute('ozuna');
    const app2 = createApp({ doc, storage, animate: false }).attach();
    app2.render();
    expect(app2.muted).toContain('ozuna');
  });

  it('reveals the Hidden filter only once something is muted', () => {
    expect(doc.querySelector('.muted-filter').hidden).toBe(true);
    app.mute('ozuna');
    expect(doc.querySelector('.muted-filter').hidden).toBe(false);
    expect(doc.querySelector('.muted-filter .count').textContent).toBe('1');
  });

  it('shows muted artists in the Hidden view and nothing else', () => {
    app.mute('ozuna');
    app.setFilter('muted');
    expect(visible()).toEqual(['Ozuna']);
  });

  it('lists muted artists by name with an unmute control', () => {
    app.mute('cafetacvba');
    app.setFilter('muted');
    const names = [...doc.querySelectorAll('#muted-list .unmute')].map(b => b.textContent);
    expect(names).toEqual(['Café Tacvba']);
  });

  it('brings an artist back when unmuted from the panel', () => {
    app.mute('ozuna');
    app.setFilter('muted');
    doc.querySelector('#muted-list .unmute')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    app.setFilter('all');
    expect(visible()).toContain('Ozuna');
  });

  it('leaves the Hidden view when the last artist is unmuted', () => {
    app.mute('ozuna');
    app.setFilter('muted');
    app.unmute('ozuna');
    expect(app.filter).toBe('all');
    expect(visible()).toHaveLength(3);
  });

  it('keeps a muted artist out of every other filter', () => {
    app.mute('ozuna');
    app.setFilter('fortnight');
    expect(visible()).toEqual(['Café Tacvba']);
    app.setFilter('new');
    expect(visible()).toEqual([]);
  });

  it('keeps a muted artist out of search results', () => {
    app.mute('ozuna');
    app.setQuery('ozuna');
    expect(visible()).toEqual([]);
  });
});

describe('muting from the committed list', () => {
  beforeEach(() => setup(['Ozuna']));

  it('hides an artist muted in data/muted.json', () => {
    expect(visible()).toEqual(['Café Tacvba', 'CAIFANES']);
  });

  it('accepts a display name in the committed file, not just a key', () => {
    expect(app.muted).toContain('ozuna');
  });

  it('marks it as coming from the repo so the difference is visible', () => {
    app.setFilter('muted');
    expect(doc.querySelector('#muted-list .tag')?.textContent).toBe('in repo');
  });

  it('does not let a browser unmute silently fail to stick', () => {
    // A repo mute cannot be lifted from the browser; the tag explains why.
    app.setFilter('muted');
    app.unmute('ozuna');
    expect(app.muted).toContain('ozuna');
  });
});

describe('hiding animates the row out', () => {
  let dom, doc, app, storage;
  beforeEach(() => {
    dom = new JSDOM(`<!doctype html><html><body>${PAGE}</body></html>`, { pretendToBeVisual: true });
    doc = dom.window.document;
    const store = new Map();
    storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    app = createApp({ doc, storage });
    app.attach();
    app.render();
  });

  const row = () => doc.querySelector('.event[data-artist-key="ozuna"]');

  it('marks the row as leaving instead of hiding it at once', () => {
    app.mute('ozuna');
    expect(row().classList.contains('leaving')).toBe(true);
    expect(row().hidden).toBe(false);
  });

  it('hides the row once its transition ends', () => {
    app.mute('ozuna');
    row().dispatchEvent(new dom.window.Event('transitionend'));
    expect(row().hidden).toBe(true);
    expect(row().classList.contains('leaving')).toBe(false);
  });

  it('persists the mute immediately, not after the animation', () => {
    app.mute('ozuna');
    expect(JSON.parse(storage.getItem('bit:muted'))).toContain('ozuna');
  });

  it('still hides the row if the transition never fires', async () => {
    app.mute('ozuna');
    await new Promise(r => setTimeout(r, 450));
    expect(row().hidden).toBe(true);
  });

  it('skips the animation when the user prefers reduced motion', () => {
    dom.window.matchMedia = () => ({ matches: true });
    app.mute('ozuna');
    expect(row().hidden).toBe(true);
  });
});

describe('genre chips', () => {
  it('narrows to one family', () => {
    app.setGenre('rock');
    expect(visible()).toEqual(['Café Tacvba']);
  });

  it('clicking the active chip clears it', () => {
    app.setGenre('rock');
    doc.querySelector('[data-genre="rock"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(visible()).toHaveLength(3);
  });

  it('marks the active chip', () => {
    app.setGenre('latin');
    expect(doc.querySelector('[data-genre="latin"]').getAttribute('aria-pressed')).toBe('true');
    expect(doc.querySelector('[data-genre="rock"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('composes with the fortnight filter and search', () => {
    app.setFilter('fortnight');
    app.setGenre('latin');
    app.setQuery('mx');
    expect(visible()).toEqual(['Café Tacvba']);
  });

  it('leaves events with no genres out of every family', () => {
    app.setGenre('latin');
    expect(visible()).not.toContain('CAIFANES');
  });

  it('is remembered across a reload', () => {
    app.setGenre('rock');
    const app2 = createApp({ doc, storage, animate: false }).attach();
    app2.render();
    expect(app2.genre).toBe('rock');
  });
});

describe('opening a shared link', () => {
  const scrolled = () => [...doc.querySelectorAll('.event')].filter(r => r._scrolled).map(r => r.getAttribute('data-short-id'));
  beforeEach(() => {
    for (const r of doc.querySelectorAll('.event')) r.scrollIntoView = function () { this._scrolled = true; };
  });

  it('scrolls to the event named in the hash and marks it', () => {
    app.reveal('caifanes');
    expect(scrolled()).toEqual(['caifanes']);
    expect(doc.getElementById('e-caifanes').classList.contains('target')).toBe(true);
  });

  it('clears a filter that would hide the event', () => {
    app.setFilter('fortnight');            // caifanes is outside the fortnight
    app.reveal('caifanes');
    expect(app.filter).toBe('all');
    expect(doc.getElementById('e-caifanes').hidden).toBe(false);
  });

  it('clears a search that would hide the event', () => {
    app.setQuery('ozuna');
    app.reveal('caifanes');
    expect(doc.getElementById('e-caifanes').hidden).toBe(false);
  });

  it('does not touch the filters when the event is already visible', () => {
    app.setFilter('fortnight');
    app.reveal('ozuna');
    expect(app.filter).toBe('fortnight');
  });

  it('does nothing for an unknown id', () => {
    app.reveal('nope');
    expect(scrolled()).toEqual([]);
  });

  it('reads the id from the location hash on attach', () => {
    dom.window.location.hash = '#e-cafetacvba';
    const app2 = createApp({ doc, storage, animate: false }).attach();
    app2.render();
    expect(scrolled()).toEqual(['cafetacvba']);
  });
});
