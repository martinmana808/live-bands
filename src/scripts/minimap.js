const day = (iso) => Date.parse(iso + 'T00:00:00Z') / 86400000;

/**
 * The event date closest to a target, so clicking an empty stretch of the
 * minimap lands somewhere sensible instead of doing nothing. Ties go to the
 * later date: from an empty gap you are more likely looking ahead than back.
 *
 * @param {string[]} dates
 * @param {string} target
 * @returns {string|null}
 */
export function nearestDate(dates, target) {
  if (dates.length === 0) return null;
  const t = day(target);
  let best = null;
  let bestDist = Infinity;
  for (const d of dates) {
    const dist = Math.abs(day(d) - t);
    if (dist < bestDist || (dist === bestDist && d > best)) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Mark the bars whose shows are currently on screen and stretch an overlay
 * across them, so the minimap says where you are and not just what exists.
 *
 * @param {Document} doc
 */
export function updateViewport(doc) {
  const win = doc.defaultView;
  const viewH = win?.innerHeight ?? 0;
  const bars = [...doc.querySelectorAll('button.bar[data-bucket-start]')];
  const overlay = doc.querySelector('.soundwave .viewport');
  if (bars.length === 0) return;

  const onScreen = [...doc.querySelectorAll('.event[data-event-date]')]
    .filter(r => !r.hidden)
    .filter(r => { const b = r.getBoundingClientRect(); return b.bottom > 0 && b.top < viewH; })
    .map(r => r.getAttribute('data-event-date'));

  for (const b of bars) b.classList.remove('inview');
  if (onScreen.length === 0) { if (overlay) overlay.hidden = true; return; }

  const barDates = bars.map(b => b.getAttribute('data-bucket-start'));
  const first = nearestDate(barDates, onScreen[0]);
  const last = nearestDate(barDates, onScreen[onScreen.length - 1]);
  const lo = Math.min(barDates.indexOf(first), barDates.indexOf(last));
  const hi = Math.max(barDates.indexOf(first), barDates.indexOf(last));

  for (let i = lo; i <= hi; i++) bars[i].classList.add('inview');

  if (overlay) {
    const top = bars[lo].offsetTop;
    const bottom = bars[hi].offsetTop + bars[hi].offsetHeight;
    overlay.style.top = `${top}px`;
    overlay.style.height = `${Math.max(2, bottom - top)}px`;
    overlay.hidden = false;
  }
}

/**
 * @param {Document} doc
 */
export function attachMinimap(doc) {
  for (const b of doc.querySelectorAll('button.bar[disabled]')) b.disabled = false;

  const win = doc.defaultView;
  if (win) {
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      (win.requestAnimationFrame ?? ((fn) => win.setTimeout(fn, 16)))(() => { queued = false; updateViewport(doc); });
    };
    win.addEventListener('scroll', schedule, { passive: true });
    win.addEventListener('resize', schedule);
    // Filters change which rows exist on screen without scrolling.
    new win.MutationObserver(schedule).observe(doc.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    schedule();
  }

  doc.addEventListener('click', (e) => {
    const bar = e.target.closest?.('button.bar[data-bucket-start]');
    if (!bar) return;
    const target = bar.getAttribute('data-bucket-start');

    const rows = [...doc.querySelectorAll('.event[data-event-date]')].filter(r => !r.hidden);
    const want = nearestDate(rows.map(r => r.getAttribute('data-event-date')), target);
    if (!want) return;

    const row = rows.find(r => r.getAttribute('data-event-date') === want);
    row?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
