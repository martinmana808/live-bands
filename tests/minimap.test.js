import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { nearestDate, attachMinimap, updateViewport } from '../src/scripts/minimap.js';

describe('nearestDate', () => {
  const dates = ['2026-10-05', '2027-01-15', '2027-04-14'];

  it('returns an exact hit', () => {
    expect(nearestDate(dates, '2027-01-15')).toBe('2027-01-15');
  });

  it('snaps an empty day to the closest event by distance', () => {
    expect(nearestDate(dates, '2027-02-01')).toBe('2027-01-15');   // 17 days back vs 72 forward
    expect(nearestDate(dates, '2027-03-20')).toBe('2027-04-14');   // 25 forward vs 64 back
  });

  it('prefers the upcoming show on a tie', () => {
    expect(nearestDate(['2026-10-01', '2026-10-11'], '2026-10-06')).toBe('2026-10-11');
  });

  it('handles a target before every event', () => {
    expect(nearestDate(dates, '2026-01-01')).toBe('2026-10-05');
  });

  it('handles a target after every event', () => {
    expect(nearestDate(dates, '2028-01-01')).toBe('2027-04-14');
  });

  it('returns null with no events', () => {
    expect(nearestDate([], '2026-10-05')).toBeNull();
  });
});

describe('attachMinimap', () => {
  const page = `
    <aside><div class="rail">
      <button class="bar active" data-bucket-start="2026-10-05"></button>
      <button class="bar" data-bucket-start="2027-02-01"></button>
      <button class="bar active" data-bucket-start="2027-04-14"></button>
    </div></aside>
    <main>
      <div class="event" data-event-date="2026-10-05" id="a"></div>
      <div class="event" data-event-date="2027-01-15" id="b"></div>
      <div class="event" data-event-date="2027-04-14" id="c" hidden></div>
    </main>`;

  const setup = () => {
    const dom = new JSDOM(`<!doctype html><html><body>${page}</body></html>`);
    const doc = dom.window.document;
    const scrolled = [];
    for (const el of doc.querySelectorAll('.event')) el.scrollIntoView = () => scrolled.push(el.id);
    attachMinimap(doc);
    return { dom, doc, scrolled };
  };

  const click = (dom, el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  it('scrolls to the nearest show when an empty bar is clicked', () => {
    const { dom, doc, scrolled } = setup();
    click(dom, doc.querySelector('[data-bucket-start="2027-02-01"]'));
    expect(scrolled).toEqual(['b']);
  });

  it('ignores rows hidden by a filter or a mute', () => {
    const { dom, doc, scrolled } = setup();
    click(dom, doc.querySelector('[data-bucket-start="2027-04-14"]'));
    expect(scrolled).toEqual(['b']);  // 'c' is hidden, so the nearest visible show wins
  });

  it('does not leave empty bars disabled', () => {
    const { doc } = setup();
    expect([...doc.querySelectorAll('button.bar')].every(b => !b.disabled)).toBe(true);
  });
});

describe('viewport indicator', () => {
  const page = `
    <aside class="soundwave"><div class="rail">
      <button class="bar" data-bucket-start="2026-10-01"></button>
      <button class="bar" data-bucket-start="2026-10-02"></button>
      <button class="bar" data-bucket-start="2026-10-03"></button>
      <button class="bar" data-bucket-start="2026-10-04"></button>
      <div class="viewport"></div>
    </div></aside>
    <main>
      <div class="event" data-event-date="2026-10-01" id="a"></div>
      <div class="event" data-event-date="2026-10-02" id="b"></div>
      <div class="event" data-event-date="2026-10-03" id="c"></div>
      <div class="event" data-event-date="2026-10-04" id="d"></div>
    </main>`;

  const setup = (rects) => {
    const dom = new JSDOM(`<!doctype html><html><body>${page}</body></html>`, { pretendToBeVisual: true });
    const doc = dom.window.document;
    Object.defineProperty(dom.window, 'innerHeight', { value: 800, configurable: true });
    for (const el of doc.querySelectorAll('.event')) {
      el.getBoundingClientRect = () => rects[el.id] ?? { top: 5000, bottom: 5100 };
    }
    // rail bars are 10px tall each, stacked from y=0
    doc.querySelectorAll('.bar').forEach((b, i) => {
      Object.defineProperty(b, 'offsetTop', { value: i * 10 });
      Object.defineProperty(b, 'offsetHeight', { value: 10 });
    });
    attachMinimap(doc);
    return { dom, doc };
  };

  it('marks the bars whose shows are on screen', () => {
    const { doc } = setup({ a: { top: -300, bottom: -200 }, b: { top: 10, bottom: 100 }, c: { top: 200, bottom: 300 }, d: { top: 900, bottom: 1000 } });
    updateViewport(doc);
    const on = [...doc.querySelectorAll('.bar.inview')].map(b => b.getAttribute('data-bucket-start'));
    expect(on).toEqual(['2026-10-02', '2026-10-03']);
  });

  it('positions the overlay from the first visible bar to the last', () => {
    const { doc } = setup({ a: { top: -300, bottom: -200 }, b: { top: 10, bottom: 100 }, c: { top: 200, bottom: 300 }, d: { top: 900, bottom: 1000 } });
    updateViewport(doc);
    const v = doc.querySelector('.viewport');
    expect(v.style.top).toBe('10px');
    expect(v.style.height).toBe('20px');
    expect(v.hidden).toBe(false);
  });

  it('ignores rows hidden by a filter', () => {
    const { doc } = setup({ a: { top: 10, bottom: 100 }, b: { top: 200, bottom: 300 } });
    doc.getElementById('a').hidden = true;
    updateViewport(doc);
    expect([...doc.querySelectorAll('.bar.inview')].map(b => b.getAttribute('data-bucket-start'))).toEqual(['2026-10-02']);
  });

  it('hides the overlay when nothing is on screen', () => {
    const { doc } = setup({});
    updateViewport(doc);
    expect(doc.querySelector('.viewport').hidden).toBe(true);
  });

  it('still works when a date has no bar (snaps to the nearest)', () => {
    const { doc } = setup({ b: { top: 10, bottom: 100 } });
    doc.getElementById('b').setAttribute('data-event-date', '2026-10-02');
    doc.querySelector('[data-bucket-start="2026-10-02"]').remove();
    updateViewport(doc);
    expect(doc.querySelector('.viewport').hidden).toBe(false);
  });
});
