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
 * @param {Document} doc
 */
export function attachMinimap(doc) {
  for (const b of doc.querySelectorAll('button.bar[disabled]')) b.disabled = false;

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
