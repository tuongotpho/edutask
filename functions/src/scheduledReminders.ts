import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getDb } from './firebase';
import { sendToUser, sendToUsers } from './push';
import {
  dueItemsForUser,
  resolveReminderRecipients,
  shouldFire,
  upcomingMilestones,
  upcomingTaskReminders,
} from './shared/lib/reminderSchedule';
import type { ReminderSchedule } from './shared/types/reminder';
import type { Plan } from './shared/types/plan';
import type { Task } from './shared/types/task';

/**
 * The server half of the reminder system.
 *
 * The rules for "is this schedule due today?" and "what is coming up?" are NOT
 * reimplemented here — they are the same functions the browser runs, copied in
 * by scripts/sync-shared-logic.mjs. If the app tells a tổ trưởng their reminder
 * fires on the 25th, the server fires it on the 25th, because it is the same
 * code answering.
 *
 * TIME ZONE: every schedule runs in Asia/Ho_Chi_Minh. Omitting that would make
 * a 07:30 reminder go out at 14:30 local — the classic way a scheduled job
 * quietly becomes useless.
 */

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const REGION = 'asia-southeast1';

/** `YYYY-MM-DD` and the hour, both in Vietnam time regardless of server locale. */
function localNow(): { date: string; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    // Intl renders midnight as "24" in some locales; normalise it.
    hour: Number(parts.hour) % 24,
  };
}

/**
 * Runs hourly and fires the schedules whose configured hour has arrived.
 *
 * Hourly rather than once a day because schedules carry a time of day, and a
 * single daily run would ignore it. Matching on the HOUR only (not the minute)
 * is a deliberate simplification: a reminder that arrives at 07:00 instead of
 * 07:30 is fine, while running this every minute would multiply invocations
 * 60-fold for no benefit anyone would notice.
 */
export const runReminderSchedules = onSchedule(
  { schedule: 'every 1 hours', timeZone: TIMEZONE, region: REGION },
  async () => {
    const { date, hour } = localNow();
    const db = getDb();

    const snapshot = await db.collection('reminders').where('isActive', '==', true).get();
    const schedules = snapshot.docs.map(doc => doc.data() as ReminderSchedule);

    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => doc.data() as {
      id: string; departmentId: string; roles?: string[]; status?: string;
    });

    let fired = 0;

    for (const schedule of schedules) {
      const scheduledHour = Number((schedule.timeOfDay ?? '').split(':')[0]);
      if (!Number.isFinite(scheduledHour) || scheduledHour !== hour) continue;
      if (!shouldFire(schedule, date)) continue;

      const recipients = resolveReminderRecipients(schedule, users);
      if (recipients.length === 0) {
        logger.warn(`Reminder ${schedule.id} has no recipients; skipping`);
        continue;
      }

      const delivered = await sendToUsers(recipients, {
        title: schedule.title,
        body: schedule.message ?? 'Nhắc việc theo lịch của nhà trường.',
        url: '/?tab=ke-hoach',
        tag: `reminder-${schedule.id}`,
      });

      // Written even when zero devices were reached: `lastFiredOn` records that
      // this occurrence was PROCESSED. Without it a retry — or the next hourly
      // run in a school where nobody has enabled push yet — would treat the
      // schedule as still pending and process it again.
      await db.collection('reminders').doc(schedule.id).update({ lastFiredOn: date });

      // The in-app notification is written regardless of push, so a person who
      // never enabled notifications still sees the reminder on the bell.
      await Promise.all(
        recipients.map(userId =>
          db.collection('notifications').doc(`RMD_${schedule.id}_${date}_${userId}`).set({
            id: `RMD_${schedule.id}_${date}_${userId}`,
            recipientUserId: userId,
            title: schedule.title,
            message: schedule.message ?? 'Nhắc việc theo lịch của nhà trường.',
            type: 'SYSTEM',
            linkUrl: '/?tab=ke-hoach',
            // Marked read so the mirroring trigger does not push it a second
            // time — this function has already sent it directly.
            isRead: true,
            createdAt: `${date} ${String(hour).padStart(2, '0')}:00`,
          })
        )
      );

      fired += 1;
      logger.info(`Reminder "${schedule.title}" → ${recipients.length} người, ${delivered} thiết bị`);
    }

    logger.info(`Reminder sweep at ${date} ${hour}:00 — ${fired} schedule(s) fired`);
  }
);

/**
 * The daily "what is due" digest, at 07:00 local.
 *
 * One message per person summarising everything, never one per item: a teacher
 * with four overdue tasks would otherwise get four buzzes in a row and turn
 * notifications off — which costs the school every future reminder too.
 */
export const dailyDueDigest = onSchedule(
  { schedule: '0 7 * * *', timeZone: TIMEZONE, region: REGION },
  async () => {
    const { date } = localNow();
    const db = getDb();

    const [tasksSnapshot, plansSnapshot] = await Promise.all([
      db.collection('tasks').get(),
      db.collection('plans').get(),
    ]);

    const tasks = tasksSnapshot.docs.map(doc => doc.data() as Task);
    const plans = plansSnapshot.docs.map(doc => doc.data() as Plan);

    const allItems = [
      ...upcomingTaskReminders(tasks, date, 3),
      ...upcomingMilestones(plans, date, 7),
    ];
    if (allItems.length === 0) {
      logger.info('Nothing due; no digest sent');
      return;
    }

    const recipients = Array.from(new Set(allItems.flatMap(item => item.recipientIds)));
    let sent = 0;

    for (const userId of recipients) {
      const mine = dueItemsForUser(allItems, userId);
      if (mine.length === 0) continue;

      const overdue = mine.filter(item => item.isOverdue);
      const soon = mine.filter(item => !item.isOverdue);

      const parts: string[] = [];
      if (overdue.length > 0) parts.push(`${overdue.length} việc quá hạn`);
      if (soon.length > 0) parts.push(`${soon.length} việc sắp đến hạn`);

      const delivered = await sendToUser(userId, {
        title: 'Nhắc việc hôm nay',
        // Naming the most urgent item makes the notification actionable from
        // the lock screen instead of just a count that forces the app open.
        body: `${parts.join(' · ')}. Gần nhất: ${mine[0].title}.`,
        url: '/?tab=ke-hoach',
        tag: 'due-digest',
      });

      if (delivered > 0) sent += 1;
    }

    logger.info(`Daily digest ${date}: ${sent}/${recipients.length} người nhận được`);
  }
);
