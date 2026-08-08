/**
 * EduTask Cloud Functions.
 *
 * Three functions, all concerned with reaching people who do not have the app
 * open:
 *
 *  - onNotificationCreated — mirrors every in-app notification to the
 *    recipient's devices. One trigger covers every current feature and every
 *    future one, because they all write notifications.
 *  - runReminderSchedules  — hourly sweep firing the recurring reminders the
 *    school configured.
 *  - dailyDueDigest        — one morning summary of what is due, per person.
 *
 * Region is asia-southeast1 (Singapore) throughout: it is the closest Firebase
 * region to Vietnam, and keeping functions in one region avoids cross-region
 * latency between the trigger and Firestore.
 */

export { onNotificationCreated } from './onNotificationCreated';
export { runReminderSchedules, dailyDueDigest } from './scheduledReminders';

// Group announcements. Moved off the client so the Telegram bot token stops
// being readable by every signed-in account — see telegram.ts.
export {
  onLeaveCreatedTelegram,
  onLeaveDecidedTelegram,
  onTaskCreatedTelegram,
} from './telegramTriggers';
