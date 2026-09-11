import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { nearestDate, attachMinimap } from '../src/scripts/minimap.js';

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
