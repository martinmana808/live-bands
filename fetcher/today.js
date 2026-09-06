/**
 * Every date in this project means a date in Buenos Aires. Deriving "today"
 * from UTC puts the site three hours into the future every evening, which
 * drops shows that are still on tonight.
 */
export const TIMEZONE = 'America/Argentina/Buenos_Aires';

const FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * @param {Date} [now]
 * @returns {string} "YYYY-MM-DD"
 */
export function todayInBuenosAires(now = new Date()) {
  return FORMATTER.format(now);
}
