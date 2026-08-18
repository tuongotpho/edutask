import { logger } from 'firebase-functions';
import { getDb, getPushMessaging } from './firebase';

/**
 * Delivering a notification to a person's devices.
 *
 * Two behaviours here matter more than they look:
 *
 * 1. **Dead tokens are pruned.** A registration token dies when the user clears
 *    site data, uninstalls the PWA, or simply does not open the app for a couple
 *    of months. FCM reports these per-token; if they are never removed the
 *    collection grows without bound and every send wastes quota on addresses
 *    nobody is behind. Only the two errors that mean "this token is gone for
 *    good" trigger deletion — a transient network failure must not throw away a
 *    working device.
 *
 * 2. **A failure never propagates.** These functions are triggered by records
 *    that are already written. Throwing would make the platform retry the whole
 *    trigger and re-send to everyone who did receive it.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping it should land, e.g. `/?tab=cuoc-hop`. */
  url?: string;
  /** Notifications sharing a tag replace each other instead of stacking. */
  tag?: string;
}

/** FCM errors that mean the token will never work again. */
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * `sendEachForMulticast` REJECTS a list longer than this — it does not truncate.
 *
 * That mattered on the school-wide reminder path: `sendToUsers` flattens every
 * device of every recipient into one list, so a school past ~500 registered
 * devices tripped the limit, the throw was swallowed by the catch below, and
 * NOBODY was notified — while the schedule was still stamped `lastFiredOn`, so
 * the occurrence was never retried. One log line was the only trace.
 */
const FCM_MAX_TOKENS_PER_SEND = 500;

async function tokensFor(userId: string): Promise<string[]> {
  const snapshot = await getDb().collection('pushTokens').where('userId', '==', userId).get();
  return snapshot.docs.map(doc => doc.id);
}

async function pruneTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const db = getDb();
  const batch = db.batch();
  tokens.forEach(token => batch.delete(db.collection('pushTokens').doc(token)));
  await batch.commit();
  logger.info(`Pruned ${tokens.length} dead push token(s)`);
}

/** Sends to every device belonging to one person. Returns how many landed. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  const tokens = await tokensFor(userId);
  if (tokens.length === 0) return 0;
  return sendToTokens(tokens, payload);
}

/** Sends to several people at once, de-duplicating shared devices. */
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (unique.length === 0) return 0;

  const tokenLists = await Promise.all(unique.map(tokensFor));
  const tokens = Array.from(new Set(tokenLists.flat()));
  return sendToTokens(tokens, payload);
}

async function sendToTokens(tokens: string[], payload: PushPayload): Promise<number> {
  if (tokens.length === 0) return 0;

  // Batches are sent in sequence, not in parallel: a school-wide push is not
  // time-critical, and firing every batch at once is how a burst turns into
  // rate-limiting that costs deliveries.
  let total = 0;
  for (let i = 0; i < tokens.length; i += FCM_MAX_TOKENS_PER_SEND) {
    total += await sendOneBatch(tokens.slice(i, i + FCM_MAX_TOKENS_PER_SEND), payload);
  }
  return total;
}

async function sendOneBatch(tokens: string[], payload: PushPayload): Promise<number> {
  try {
    const response = await getPushMessaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      // The data block is what the service worker reads; the notification block
      // is what the OS renders when the app is fully closed. Both are sent so
      // delivery works in every app state.
      data: {
        title: payload.title,
        body: payload.body,
        url: payload.url ?? '/',
        tag: payload.tag ?? 'edutask',
      },
      webpush: {
        fcmOptions: { link: payload.url ?? '/' },
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: payload.tag ?? 'edutask',
        },
      },
    });

    const dead: string[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = (result.error as { code?: string } | undefined)?.code;
      if (code && DEAD_TOKEN_ERRORS.has(code)) dead.push(tokens[index]);
      else logger.warn(`Push failed for a token: ${code ?? 'unknown error'}`);
    });

    await pruneTokens(dead);
    return response.successCount;
  } catch (err) {
    // Never rethrow: the record this announces is already saved, and a retry
    // would re-notify everyone who did receive it. Losing one batch is better
    // than re-buzzing every device that already got it.
    logger.error(`Push send failed for a batch of ${tokens.length} token(s)`, err);
    return 0;
  }
}
