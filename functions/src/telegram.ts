import { logger } from 'firebase-functions';
import { getDb } from './firebase';
import type { TelegramConfig, TelegramEvent } from './shared/types/settings';

/**
 * Thông báo nhóm qua Telegram — now sent from the server.
 *
 * This used to run in the teacher's browser, which meant the bot token had to
 * be readable by every signed-in account. Anyone could then post to the
 * school's group AS the school, and the token was visible in the network tab
 * of any staff member's browser.
 *
 * Moving it here removes the token from the client entirely: `settings/telegram`
 * is now admin-read-only, and the Admin SDK bypasses rules. The one thing that
 * still needs the token in a browser is the admin's "gửi thử" button, which is
 * an admin acting deliberately on their own configuration.
 *
 * Delivery stays best-effort: failing to announce a leave request must never
 * fail the leave request, and these run after the record is already written.
 */

const TELEGRAM_API = 'https://api.telegram.org';

/** Telegram's HTML parse mode allows only a few tags; escape everything else. */
export function escapeHtml(text: string): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function loadConfig(): Promise<TelegramConfig | null> {
  const snapshot = await getDb().collection('settings').doc('telegram').get();
  const data = snapshot.data();
  if (!data) return null;

  return {
    enabled: !!data.enabled,
    botToken: typeof data.botToken === 'string' ? data.botToken : '',
    chatId: typeof data.chatId === 'string' ? data.chatId : '',
    events: {
      LEAVE_CREATED: data.events?.LEAVE_CREATED !== false,
      LEAVE_DECIDED: data.events?.LEAVE_DECIDED !== false,
      TASK_ASSIGNED: data.events?.TASK_ASSIGNED !== false,
    },
  };
}

/**
 * Sends if the bot is configured AND this event is switched on. Silent when it
 * is not — callers do not have to check first.
 */
export async function notifyTelegram(event: TelegramEvent, html: string): Promise<void> {
  const config = await loadConfig();
  if (!config?.enabled || !config.botToken.trim() || !config.chatId.trim()) return;
  if (!config.events?.[event]) return;

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${config.botToken.trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId.trim(),
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      // Telegram returns a `description` explaining the refusal; it is the
      // difference between "wrong token" and "bot not in that group".
      const payload = (await response.json().catch(() => null)) as { description?: string } | null;
      logger.warn(`Telegram (${event}) refused:`, payload?.description ?? `HTTP ${response.status}`);
    }
  } catch (err) {
    logger.error(`Telegram (${event}) failed:`, err);
  }
}

/**
 * Message builders. Moved here from the client with their wording intact, so
 * the group sees exactly the same messages it did before.
 */
export const telegramMessages = {
  leaveCreated(params: {
    applicantName: string;
    departmentName: string;
    leaveTypeLabel: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
  }): string {
    return [
      '📝 <b>Đơn xin nghỉ mới cần duyệt</b>',
      `👤 ${escapeHtml(params.applicantName)} — ${escapeHtml(params.departmentName)}`,
      `📅 ${escapeHtml(params.startDate)} → ${escapeHtml(params.endDate)} (${params.totalDays} ngày)`,
      `🏷 ${escapeHtml(params.leaveTypeLabel)}`,
      `💬 ${escapeHtml(params.reason)}`,
    ].join('\n');
  },

  leaveDecided(params: {
    applicantName: string;
    decisionLabel: string;
    stepLabel: string;
    approverName: string;
    comment?: string;
  }): string {
    const lines = [
      `📋 <b>Đơn xin nghỉ: ${escapeHtml(params.decisionLabel)}</b>`,
      `👤 Người xin nghỉ: ${escapeHtml(params.applicantName)}`,
      `✍️ ${escapeHtml(params.stepLabel)} — ${escapeHtml(params.approverName)}`,
    ];
    if (params.comment?.trim()) lines.push(`💬 ${escapeHtml(params.comment)}`);
    return lines.join('\n');
  },

  taskAssigned(params: {
    title: string;
    assignerName: string;
    assigneeSummary: string;
    deadline: string;
    priorityLabel: string;
  }): string {
    return [
      '📌 <b>Công việc mới được giao</b>',
      `📄 ${escapeHtml(params.title)}`,
      `👤 Người giao: ${escapeHtml(params.assignerName)}`,
      `👥 Người nhận: ${escapeHtml(params.assigneeSummary)}`,
      `⏰ Hạn: ${escapeHtml(params.deadline)} · ${escapeHtml(params.priorityLabel)}`,
    ].join('\n');
  },
};
