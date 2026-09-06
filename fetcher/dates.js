const MONTHS = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
};

// Venue listings drop the year, so a bare "14 de enero" seen in September means
// next January. Anything up to this much in the past is taken at face value —
// listings linger for a few weeks after the show.
const BACKDATE_GRACE_DAYS = 45;

function daysBetween(aIso, bIso) {
  return (Date.parse(aIso + 'T00:00:00Z') - Date.parse(bIso + 'T00:00:00Z')) / 86400000;
}

/**
 * Parse a Spanish venue-listing date into "YYYY-MM-DD".
 *
 * @param {string} text
 * @param {string} today  - "YYYY-MM-DD"
 * @returns {string|null}
 */
export function parseSpanishDate(text, today) {
  if (!text) return null;

  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const m = text.toLowerCase().match(/\b(\d{1,2})\s+(?:de\s+)?([a-záéíóúü]+)(?:\s+de\s+(\d{4}))?/);
  if (!m) return null;

  const month = MONTHS[m[2]];
  if (!month) return null;

  const day = m[1].padStart(2, '0');
  if (m[3]) return `${m[3]}-${month}-${day}`;

  const thisYear = today.slice(0, 4);
  const candidate = `${thisYear}-${month}-${day}`;
  if (daysBetween(candidate, today) < -BACKDATE_GRACE_DAYS) {
    return `${Number(thisYear) + 1}-${month}-${day}`;
  }
  return candidate;
}
