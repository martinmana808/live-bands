/** How recently an event must have appeared to be worth badging as new. */
export const RECENT_DAYS = 7;

function daysBetween(fromIso, toIso) {
  return (Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000;
}

/**
 * Is this event inside the next `days` days? Shares its definition of a
 * fortnight with buildDigest so the page and the notification agree.
 *
 * @param {string} date
 * @param {string} today
 * @param {number} days
 */
export function isWithinDays(date, today, days) {
  return date >= today && daysBetween(today, date) <= days;
}

/**
 * @param {{firstSeenAt?: string}} event
 * @param {string} today
 * @param {number} [days]
 */
export function isRecentlyAdded(event, today, days = RECENT_DAYS) {
  if (!event.firstSeenAt) return false;
  return daysBetween(event.firstSeenAt, today) <= days;
}
