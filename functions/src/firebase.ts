import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

/**
 * Admin SDK wiring.
 *
 * CRITICAL: this project stores everything in a NAMED Firestore database
 * (`edutask`), not `(default)`. `getFirestore()` with no argument would connect
 * to the empty default database and every query would return zero rows —
 * silently, with no error — so the name is passed explicitly, exactly as the
 * client does in `Edu-task/lib/firebase.ts`.
 *
 * Everything is initialised LAZILY. During deployment the CLI imports this
 * codebase purely to discover which functions exist, and it gives that import
 * ten seconds. Calling `initializeApp()` / `getMessaging()` at module scope
 * does credential work during that window and the analysis times out with
 * "Cannot determine backend specification" — which reads like a code error but
 * is really just slow module initialisation.
 */

const DATABASE_ID = 'edutask';

function ensureApp() {
  return getApps().length === 0 ? initializeApp() : getApps()[0];
}

let firestoreInstance: Firestore | null = null;
let messagingInstance: Messaging | null = null;

export function getDb(): Firestore {
  if (!firestoreInstance) {
    ensureApp();
    firestoreInstance = getFirestore(DATABASE_ID);
  }
  return firestoreInstance;
}

export function getPushMessaging(): Messaging {
  if (!messagingInstance) {
    ensureApp();
    messagingInstance = getMessaging();
  }
  return messagingInstance;
}
