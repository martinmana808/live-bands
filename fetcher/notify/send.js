import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildDigest } from '../digest.js';
import { formatDigest } from './format.js';
import { sendTelegram } from './telegram.js';
import { todayInBuenosAires } from '../today.js';

const EVENTS_PATH = 'data/events.json';
const STATE_PATH = 'data/digest-state.json';
const SITE_URL = 'https://martinmana808.github.io/live-bands/';

async function loadState() {
  if (!existsSync(STATE_PATH)) return { lastSentAt: null };
  return JSON.parse(await readFile(STATE_PATH, 'utf8'));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const today = todayInBuenosAires();
  const events = JSON.parse(await readFile(EVENTS_PATH, 'utf8'));
  const state = await loadState();

  // "New" means new since the last digest actually sent, not since yesterday's
  // rebuild — so a weekly reader still sees everything added during the week.
  const since = state.lastSentAt ?? today;
  const digest = buildDigest(events, { today, since });
  const text = formatDigest(digest, { siteUrl: SITE_URL });

  console.log(`digest: ${digest.fortnight.length} in the next fortnight, ${digest.newlyAdded.length} new since ${since}`);

  if (dryRun) {
    console.log('--- dry run, not sending ---');
    console.log(text);
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chatId) {
    console.warn('[telegram] no credentials, skipping send');
    return;
  }

  await sendTelegram({ token, chatId }, text);
  await writeFile(STATE_PATH, JSON.stringify({ lastSentAt: today }, null, 2) + '\n');
  console.log(`sent, state advanced to ${today}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
