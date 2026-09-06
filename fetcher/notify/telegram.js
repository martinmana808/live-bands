const API = 'https://api.telegram.org';

/**
 * @param {{token: string, chatId: string}} creds
 * @param {string} text  - Telegram-flavoured HTML
 */
export async function sendTelegram({ token, chatId }, text) {
  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`telegram HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}
