import { LeaveType } from './leave';

/**
 * Admin-configurable approval flow. Previously the two steps
 * (dept leader → executive) were hardcoded in `createLeaveRequest`.
 */
export interface WorkflowConfig {
  /**
   * A request of at most this many days finishes at the department-leader step.
   * 0 means every request also needs Ban Giám Hiệu.
   */
  deptOnlyMaxDays: number;
  /** Leave types that always need executive sign-off regardless of length. */
  alwaysExecutiveTypes: LeaveType[];
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  // Preserves the behaviour that existed before this was configurable:
  // every request goes to both levels.
  deptOnlyMaxDays: 0,
  alwaysExecutiveTypes: [],
};

export type TelegramEvent =
  | 'LEAVE_CREATED'
  | 'LEAVE_DECIDED'
  | 'TASK_ASSIGNED';

export const TELEGRAM_EVENT_LABELS: Record<TelegramEvent, string> = {
  LEAVE_CREATED: 'Có đơn xin nghỉ mới cần duyệt',
  LEAVE_DECIDED: 'Đơn xin nghỉ được duyệt / từ chối',
  TASK_ASSIGNED: 'Có công việc mới được giao',
};

/**
 * Telegram bot used for group notifications. Optional by design: with no token
 * or chat id configured the app simply never sends anything.
 *
 * SECURITY NOTE: this app has no server, so the bot token is stored in
 * Firestore and read by the browser. Any signed-in member of staff can
 * therefore read it. Use a bot dedicated to this school group and nothing else,
 * so the worst case is noise in that one chat.
 */
export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  events: Record<TelegramEvent, boolean>;
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  enabled: false,
  botToken: '',
  chatId: '',
  events: {
    LEAVE_CREATED: true,
    LEAVE_DECIDED: true,
    TASK_ASSIGNED: true,
  },
};

export function isTelegramConfigured(config: TelegramConfig | null | undefined): boolean {
  return !!config?.enabled && !!config.botToken.trim() && !!config.chatId.trim();
}
