import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createPlayer } from '../src/scripts/player.js';

const row = (key, artist, sp, hidden = false) => `
  <div class="event" data-artist-key="${key}" ${hidden ? 'hidden' : ''}>
    <div class="thumb"><img src="https://i/${key}.jpg"></div>
    <div class="artist">${artist}</div>
    ${sp ? `<button class="play" data-spotify-id="${sp}" data-artist-name="${artist}" data-artist-image="https://i/${key}.jpg"></button>` : ''}
  </div>`;

const PAGE = `<main>
  ${row('ozuna', 'Ozuna', 'sp-ozuna')}
  ${row('cafe', 'Café Tacvba', 'sp-cafe')}
  ${row('nopic', 'No Spotify', null)}
  ${row('hidden', 'Hidden One', 'sp-hidden', true)}
  ${row('caifanes', 'CAIFANES', 'sp-caifanes')}
</main>
<div id="player" hidden>
  <img id="player-art"><span id="player-name"></span>
  <button id="player-prev"></button><button id="player-toggle"></button><button id="player-next"></button>
  <div id="player-embed"><div id="player-embed-host"></div></div>
</div>
<div class="backdrop"><div class="backdrop-layer" data-layer="a"></div><div class="backdrop-layer" data-layer="b"></div></div>`;

let dom, doc, player, ctl, createdWith;

const fakeController = () => {
  const listeners = {};
  ctl = {
    loaded: [], playing: false,
    loadUri(u) { this.loaded.push(u); },
    play() { this.playing = true; },
    pause() { this.playing = false; },
    togglePlay() { this.playing = !this.playing; },
    addListener(ev, fn) { (listeners[ev] ??= []).push(fn); },
    emit(ev, data) { (listeners[ev] ?? []).forEach(fn => fn({ data })); },
  };
  return ctl;
};

beforeEach(() => {
  dom = new JSDOM(`<!doctype html><html><body>${PAGE}</body></html>`);
  doc = dom.window.document;
  createdWith = [];
  player = createPlayer({ doc, createController: (host, uri) => { createdWith.push({ host: host.id, uri }); return Promise.resolve(fakeController()); } });
  player.attach();
});

const click = (sel) => doc.querySelector(sel).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const flush = () => new Promise(r => setTimeout(r, 0));

describe('play from a row', () => {
  it('reveals the bar and loads that artist', async () => {
    click('button.play[data-spotify-id="sp-cafe"]');
    await flush();
    expect(doc.getElementById('player').hidden).toBe(false);
    expect(createdWith[0].uri).toBe('spotify:artist:sp-cafe');
    expect(doc.getElementById('player-name').textContent).toBe('Café Tacvba');
    expect(doc.getElementById('player-art').getAttribute('src')).toBe('https://i/cafe.jpg');
  });

  it('starts playback immediately rather than waiting for a second click', async () => {
    click('button.play[data-spotify-id="sp-cafe"]');
    await flush();
    expect(ctl.playing).toBe(true);
  });

  it('marks the row as now playing', async () => {
    click('button.play[data-spotify-id="sp-cafe"]');
    await flush();
    expect(doc.querySelector('[data-artist-key="cafe"]').classList.contains('playing')).toBe(true);
    expect(doc.querySelector('[data-artist-key="ozuna"]').classList.contains('playing')).toBe(false);
  });

  it('clicking the playing row again pauses instead of reloading', async () => {
    click('button.play[data-spotify-id="sp-cafe"]');
    await flush();
    click('button.play[data-spotify-id="sp-cafe"]');
    await flush();
    expect(ctl.loaded).toHaveLength(0);
    expect(createdWith).toHaveLength(1);
    expect(ctl.playing).toBe(false);
  });

  it('reuses one controller across artists', async () => {
    click('button.play[data-spotify-id="sp-cafe"]');
    await flush();
    const first = ctl;
    click('button.play[data-spotify-id="sp-ozuna"]');
    await flush();
    expect(ctl).toBe(first);
    expect(createdWith).toHaveLength(1);
    expect(ctl.loaded).toEqual(['spotify:artist:sp-ozuna']);
  });
});

describe('bar controls', () => {
  beforeEach(async () => { click('button.play[data-spotify-id="sp-cafe"]'); await flush(); });

  it('toggle pauses and resumes', () => {
    click('#player-toggle');
    expect(ctl.playing).toBe(false);
    click('#player-toggle');
    expect(ctl.playing).toBe(true);
  });

  it('next steps to the next visible artist with a spotify id', async () => {
    click('#player-next');
    await flush();
    // skips "No Spotify" and the hidden row
    expect(ctl.loaded.at(-1)).toBe('spotify:artist:sp-caifanes');
    expect(doc.getElementById('player-name').textContent).toBe('CAIFANES');
  });

  it('prev steps back', async () => {
    click('#player-prev');
    await flush();
    expect(ctl.loaded.at(-1)).toBe('spotify:artist:sp-ozuna');
  });

  it('next wraps around at the end of the list', async () => {
    click('#player-next'); await flush();   // caifanes
    click('#player-next'); await flush();   // wraps to ozuna
    expect(ctl.loaded.at(-1)).toBe('spotify:artist:sp-ozuna');
  });

  it('reflects a pause reported by spotify itself', () => {
    ctl.emit('playback_update', { isPaused: true });
    expect(doc.getElementById('player-toggle').getAttribute('aria-label')).toMatch(/play/i);
    ctl.emit('playback_update', { isPaused: false });
    expect(doc.getElementById('player-toggle').getAttribute('aria-label')).toMatch(/pause/i);
  });
});

describe('robustness', () => {
  it('stays hidden and does nothing if spotify never loads', async () => {
    const dom2 = new JSDOM(`<!doctype html><html><body>${PAGE}</body></html>`);
    const doc2 = dom2.window.document;
    createPlayer({ doc: doc2, createController: () => Promise.reject(new Error('blocked')) }).attach();
    doc2.querySelector('button.play[data-spotify-id="sp-cafe"]')
      .dispatchEvent(new dom2.window.MouseEvent('click', { bubbles: true }));
    await flush();
    expect(doc2.getElementById('player').hidden).toBe(true);
  });
});

describe('controller creation', () => {
  it('creates the controller with the first artist uri rather than loading into an empty one', async () => {
    click('button.play[data-spotify-id="sp-cafe"]');
    await flush();
    expect(createdWith).toEqual([{ host: 'player-embed-host', uri: 'spotify:artist:sp-cafe' }]);
    // the first artist is the one the controller was born with; no separate loadUri needed
    expect(ctl.loaded).toEqual([]);
    expect(ctl.playing).toBe(true);
  });

  it('uses loadUri only for subsequent artists', async () => {
    click('button.play[data-spotify-id="sp-cafe"]'); await flush();
    click('button.play[data-spotify-id="sp-ozuna"]'); await flush();
    expect(ctl.loaded).toEqual(['spotify:artist:sp-ozuna']);
  });

  it('hands the inner host to spotify so the wrapper keeps its place in the layout', async () => {
    click('button.play[data-spotify-id="sp-cafe"]'); await flush();
    expect(createdWith[0].host).toBe('player-embed-host');
  });
});

describe('backdrop', () => {
  const layers = () => [...doc.querySelectorAll('.backdrop-layer')];
  const shown = () => layers().find(l => l.classList.contains('show'));

  it('shows the playing artist image behind the page', async () => {
    click('button.play[data-spotify-id="sp-cafe"]'); await flush();
    expect(shown()?.style.backgroundImage).toContain('https://i/cafe.jpg');
  });

  it('crossfades by alternating layers when the artist changes', async () => {
    click('button.play[data-spotify-id="sp-cafe"]'); await flush();
    const first = shown();
    click('button.play[data-spotify-id="sp-ozuna"]'); await flush();
    const second = shown();
    expect(second).not.toBe(first);
    expect(second.style.backgroundImage).toContain('https://i/ozuna.jpg');
    expect(first.classList.contains('show')).toBe(false);
  });

  it('clears the backdrop when the artist has no image', async () => {
    click('button.play[data-spotify-id="sp-cafe"]'); await flush();
    doc.querySelector('button.play[data-spotify-id="sp-ozuna"]').removeAttribute('data-artist-image');
    click('button.play[data-spotify-id="sp-ozuna"]'); await flush();
    expect(shown()).toBeUndefined();
  });
});
