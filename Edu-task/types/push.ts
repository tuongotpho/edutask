/**
 * Thiết bị nhận thông báo đẩy.
 *
 * Stored in its own collection keyed by the FCM registration token, rather than
 * as an array on the user document. Three reasons:
 *
 * 1. The token IS the document id, so re-registering the same browser is an
 *    idempotent overwrite instead of an array that grows forever.
 * 2. One person legitimately has several devices — phone, staffroom PC, home
 *    laptop — and each needs its own row so a dead one can be pruned alone.
 * 3. `users` updates are tightly restricted by rules (activeRole is locked to
 *    stop self-promotion); bolting tokens onto that document would mean
 *    loosening a security-critical write path for an unrelated feature.
 */

export interface PushToken {
  /** The FCM registration token. Also the document id. */
  token: string;
  userId: string;
  /** Rough device label, so a person can tell their own devices apart. */
  deviceLabel: string;
  createdAt: string;
  /** Refreshed whenever the app confirms the token still works. */
  lastSeenAt: string;
}

/** Where the browser stands on notification permission. */
export type PushPermission =
  /** Browser has no Push API, or we are not in a browser. */
  | 'UNSUPPORTED'
  /** Supported, never asked. */
  | 'DEFAULT'
  | 'GRANTED'
  /** Refused. Cannot be asked again from code — the user must undo it in
   *  browser settings, so the UI has to say so rather than offer a button. */
  | 'DENIED';
