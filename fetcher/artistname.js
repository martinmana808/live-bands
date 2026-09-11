const WEEKDAY = 'lun|mar|mie|mié|jue|vie|sab|sáb|dom|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo';

const MONTH = [
  'ene', 'enero', 'feb', 'febrero', 'mar', 'marzo', 'abr', 'abril', 'may', 'mayo',
  'jun', 'junio', 'jul', 'julio', 'ago', 'agosto', 'sep', 'sept', 'septiembre', 'setiembre',
  'oct', 'octubre', 'nov', 'noviembre', 'dic', 'diciembre',
  'jan', 'january', 'february', 'march', 'apr', 'april', 'june', 'july',
  'aug', 'august', 'september', 'october', 'november', 'dec', 'december',
].join('|');

const SEP = '[\\s|·•\\-–—]';

// "… | 5 SEP", "… Sab 5 Sep", "… 4 de septiembre", "… 18 de diciembre de 2026"
const TRAILING_DATE = new RegExp(
  `${SEP}*\\b(?:(?:${WEEKDAY})\\.?\\s+)?\\d{1,2}\\s*(?:de\\s+)?(?:${MONTH})\\b\\.?(?:\\s+(?:de\\s+)?\\d{4})?\\s*$`,
  'i',
);

// "… 04.09", "… 4/9"
const TRAILING_NUMERIC_DATE = new RegExp(`${SEP}*\\b\\d{1,2}[./]\\d{1,2}\\b\\s*$`);

const TRAILING_PARENS = /\s*\([^()]*\)\s*$/;
const TRAILING_TOUR = /\s*\b(?:tour|gira)\s+\d{4}\s*$/i;
const TRAILING_LIVE = /\s*[|·•\-–—]?\s*\b(?:en\s+vivo|live|in\s+concert|show)\s*$/i;

// "TRINIDAD- SHOW", "Chinoy- concierto acústico ..." — a hyphen glued to the
// preceding word is a promoter's separator, never part of a name.
const GLUED_HYPHEN = /^(.+?\S)-\s+\S.*$/;

const B2B = /\s+b2b\s+/i;

// "ARDE LA SANGRE PRESENTA SU NUEVO ALBUM ..." — everything from "presenta" on
// is the venue announcing the show, not the act.
const PRESENTA = /^(.+?\S)\s+presenta\b.*$/i;

// "FLEMA - NUNCA SERÉ POLICÍA - 30 AÑOS", "VILMA PALMA e VAMPIRO - INTIMO".
// A hyphen with space on both sides separates a name from a subtitle; one
// without (Jay-Z, Sigur Rós) is part of the name and left alone.
const SPACED_HYPHEN = /^(.+?\S)\s+[-–—]\s+\S.*$/;

/**
 * Reduce a venue listing title to something worth looking up: the headliner,
 * without the date, tour tag or promoter copy the venue glued onto it.
 *
 * Deliberately conservative — a name left dirty just fails to match later,
 * but a name wrongly truncated matches the wrong artist.
 *
 * @param {string} raw
 * @returns {string}
 */
export function cleanArtistName(raw) {
  if (!raw) return '';
  let s = raw.trim().replace(/\s+/g, ' ');
  const original = s;

  if (B2B.test(s)) s = s.split(B2B)[0].trim();

  // Three or more parts is a bill, not a name with a comma in it.
  const parts = s.split(',');
  if (parts.length >= 3) s = parts[0].trim();

  const glued = s.match(GLUED_HYPHEN);
  if (glued) s = glued[1].trim();

  const spaced = s.match(SPACED_HYPHEN);
  if (spaced) s = spaced[1].trim();

  const presenta = s.match(PRESENTA);
  if (presenta) s = presenta[1].trim();

  for (const re of [TRAILING_PARENS, TRAILING_TOUR, TRAILING_LIVE, TRAILING_DATE, TRAILING_NUMERIC_DATE]) {
    s = s.replace(re, '').trim();
  }

  s = s.replace(new RegExp(`^${SEP}+|${SEP}+$`, 'g'), '').trim();

  return s.length >= 2 ? s : original;
}
