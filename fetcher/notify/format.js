const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TELEGRAM_MAX = 4096;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function longDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${DAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;
}

function flag(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

function line(e) {
  const f = flag(e.country);
  const head = `${longDate(e.date)} · <b>${esc(e.artist)}</b>${f ? ' ' + f : ''}`;
  const ticket = e.ticketUrls?.[0];
  const venue = ticket
    ? `<a href="${esc(ticket)}">${esc(e.venue)}</a>`
    : esc(e.venue);
  return `${head}\n<i>${venue}</i>`;
}

/**
 * @param {{title: string, events: any[], limit: number}} section
 */
function renderSection({ title, events, limit }) {
  if (events.length === 0) return null;
  const shown = events.slice(0, limit);
  const rest = events.length - shown.length;
  const body = shown.map(line).join('\n');
  const more = rest > 0 ? `\n<i>+${rest} more on the site</i>` : '';
  return `${title}\n${body}${more}`;
}

/**
 * Render a digest as a Telegram HTML message.
 *
 * @param {ReturnType<import('../digest.js').buildDigest>} digest
 * @param {{siteUrl: string, limit?: number}} opts
 */
export function formatDigest(digest, { siteUrl, limit = 25 }) {
  const { today, windowEnd, fortnight, newlyAdded, unconfirmedInWindow = 0 } = digest;

  const header = `🎧 <b>Bands in Town</b> — ${longDate(today)}`;

  const sections = [
    renderSection({
      title: `✨ <b>${newlyAdded.length} new show${newlyAdded.length === 1 ? '' : 's'} added</b>`,
      events: newlyAdded,
      limit,
    }),
    renderSection({
      title: `📅 <b>Next fortnight</b> (${fortnight.length}, through ${longDate(windowEnd)})`,
      events: fortnight,
      limit,
    }),
  ].filter(Boolean);

  const body = sections.length
    ? sections.join('\n\n')
    : `Nothing on in the next fortnight, and nothing new announced.`;

  const aside = unconfirmedInWindow > 0
    ? `<i>${unconfirmedInWindow} more show${unconfirmedInWindow === 1 ? '' : 's'} in the window with an unconfirmed origin.</i>\n`
    : '';
  const footer = `${aside}<a href="${esc(siteUrl)}">See everything →</a>`;
  const msg = `${header}\n\n${body}\n\n${footer}`;

  if (msg.length <= TELEGRAM_MAX) return msg;
  return formatDigest(digest, { siteUrl, limit: Math.max(1, Math.floor(limit / 2)) });
}
