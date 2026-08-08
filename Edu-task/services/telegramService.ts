import { TelegramConfig } from '@/Edu-task/types/settings';

/**
 * Telegram — admin test button only.
 *
 * Group announcements USED to be sent from here, which meant the bot token had
 * to be readable by every signed-in account: anyone could then post to the
 * school's group as the school, and the token showed up in the network tab of
 * any staff member's browser.
 *
 * Sending now happens in Cloud Functions (`functions/src/telegramTriggers.ts`),
 * and `settings/telegram` is admin-read-only. All that remains here is
 * `sendTest`, used by the admin's own configuration screen — an administrator
 * deliberately checking settings they just typed in.
 *
 * The `notify()` helper and the message builders moved to the functions package
 * with them. Leaving `notify()` behind would have kept the browser capable of
 * posting to the group, which is exactly what this change removes.
 */

const TELEGRAM_API = 'https://api.telegram.org';

/** Telegram's HTML parse mode only allows a few tags; escape everything else. */
export function escapeHtml(text: string): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface TelegramSendResult {
  ok: boolean;
  error?: string;
}

export const telegramService = {
  /**
   * The admin screen's "gửi thử" button. Reports the outcome — unlike the
   * server-side sender, which is deliberately silent — because the admin is
   * explicitly checking whether their configuration works.
   */
  async sendTest(config: TelegramConfig): Promise<TelegramSendResult> {
    if (!config.botToken.trim() || !config.chatId.trim()) {
      return { ok: false, error: 'Chưa nhập Bot Token hoặc Chat ID.' };
    }

    try {
      const response = await fetch(`${TELEGRAM_API}/bot${config.botToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId.trim(),
          text: '✅ <b>EduTask</b>\nKết nối Telegram thành công. Đây là tin nhắn thử.',
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        // Telegram returns a helpful description; surface it so the admin can
        // tell a wrong token from a wrong chat id.
        return { ok: false, error: payload?.description || `HTTP ${response.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Không gọi được Telegram API' };
    }
  },
};
