import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { sendToUser } from './push';
import type { AppNotification } from './shared/types/notification';

/**
 * Mirrors every in-app notification to the recipient's phone.
 *
 * Hooking onto the `notifications` collection rather than onto each business
 * event is the whole design. The app already writes a notification whenever
 * something happens worth telling someone about — a leave request needing
 * approval, a make-up class approved, a lateness record filed, a meeting
 * invitation. One trigger therefore covers every existing feature, and any
 * feature added later gets push for free the moment it writes a notification.
 * The alternative — a trigger per collection — would mean every new module
 * needs a matching function, and the one somebody forgets is the one that goes
 * silently undelivered.
 */
export const onNotificationCreated = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    database: 'edutask',
    region: 'asia-southeast1',
  },
  async event => {
    const data = event.data?.data() as AppNotification | undefined;
    if (!data?.recipientUserId) return;

    // Already-read on arrival means the app wrote it for its own bookkeeping;
    // buzzing a phone about something the person has evidently already seen is
    // pure noise.
    if (data.isRead) return;

    const delivered = await sendToUser(data.recipientUserId, {
      title: data.title,
      body: data.message,
      url: data.linkUrl ?? '/',
      // Tagged by notification type so a burst of the same kind collapses into
      // one entry on the lock screen instead of a stack of near-identical ones.
      tag: data.type,
    });

    logger.info(
      `Notification ${event.params.notificationId} → ${data.recipientUserId}: ${delivered} device(s)`
    );
  }
);
