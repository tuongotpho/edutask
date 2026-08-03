import { TelegramConfig, TelegramEvent, isTelegramConfigured } from '@/Edu-task/types/settings';

/**
 * Group notifications via a Telegram bot.
 *
 * This app is a static export with no server, so messages are sent straight
 * from the browser to api.telegram.org (which allows cross-origin requests).
 * Everything here is optional and best-effort: with no bot configured nothing
 * is sent, and a delivery failure is logged but never surfaced as an error on
 * the action that triggered it — failing to announce a leave request must not
 * fail the leave request.
 */

const TELEGRAM_API = 'https://api.telegram.org';

/** Telegram's HTML parse mode only allows a few tags; escape everything else. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface TelegramSendResult {
  ok: boolean;
  error?: string;
}

async function postMessage(
  config: TelegramConfig,
  html: string
): Promise<TelegramSendResult> {
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

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      // Telegram returns a helpful description; surface it for the test button.
      return { ok: false, error: payload?.description || `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Không gọi được Telegram API' };
  }
}

export const telegramService = {
  /**
   * Sends a notification if the bot is configured and the event is enabled.
   * Returns silently when it is not — callers do not need to check first.
   */
  async notify(
    config: TelegramConfig | null | undefined,
    event: TelegramEvent,
    html: string
  ): Promise<void> {
    if (!isTelegramConfigured(config) || !config!.events?.[event]) return;
    const result = await postMessage(config!, html);
    if (!result.ok) {
      console.error(`Telegram notification (${event}) failed:`, result.error);
    }
  },

  /**
   * Used by the admin screen's "send test" button. Unlike `notify` this reports
   * the outcome, because the admin is explicitly checking their settings.
   */
  async sendTest(config: TelegramConfig): Promise<TelegramSendResult> {
    if (!config.botToken.trim() || !config.chatId.trim()) {
      return { ok: false, error: 'Chưa nhập Bot Token hoặc Chat ID.' };
    }
    return postMessage(
      config,
      '✅ <b>EduTask</b>\nKết nối Telegram thành công. Đây là tin nhắn thử.'
    );
  },
};

/** Message builders — kept here so wording stays consistent across triggers. */
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
