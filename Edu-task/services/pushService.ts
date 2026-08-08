import { getMessaging, getToken, isSupported, onMessage, deleteToken, Messaging } from 'firebase/messaging';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { app, db } from '@/Edu-task/lib/firebase';
import { sanitizeForFirestore } from '@/Edu-task/lib/utils';
import { PushPermission, PushToken } from '@/Edu-task/types/push';

/**
 * Thông báo đẩy (Firebase Cloud Messaging) trên web.
 *
 * Everything here is best-effort and optional: with no VAPID key configured, or
 * on a browser without the Push API, the app behaves exactly as it did before —
 * in-app notifications still work, they simply do not reach a locked phone.
 *
 * Two constraints are worth stating because they surprise people:
 *
 * - On iOS, web push only works when the app has been added to the Home Screen
 *   and the device runs iOS 16.4+. That is Apple's rule, not ours, so the UI
 *   tells iPhone users to install the PWA rather than letting them tap a button
 *   that silently does nothing.
 * - A user who has denied permission cannot be re-prompted from code. The only
 *   way back is browser settings, so `DENIED` renders instructions, not a
 *   button that would do nothing.
 */

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() ?? '';

export function isPushConfigured(): boolean {
  return VAPID_KEY.length > 0;
}

let messagingInstance: Messaging | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (!(await isSupported().catch(() => false))) return null;
  if (!messagingInstance) messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function getPushPermission(): Promise<PushPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'UNSUPPORTED';
  if (!(await isSupported().catch(() => false))) return 'UNSUPPORTED';

  switch (Notification.permission) {
    case 'granted': return 'GRANTED';
    case 'denied': return 'DENIED';
    default: return 'DEFAULT';
  }
}

/**
 * True when this looks like an iPhone/iPad that has NOT been installed to the
 * Home Screen — the one configuration where the button would appear to work and
 * then never deliver anything.
 */
export function needsIosInstall(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (!isIos) return false;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own non-standard flag, still the reliable one on iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return !isStandalone;
}

/** A short, recognisable device name so people can prune their own list. */
function describeDevice(): string {
  if (typeof window === 'undefined') return 'Thiết bị không rõ';
  const ua = window.navigator.userAgent;

  const platform =
    /iPhone/.test(ua) ? 'iPhone'
      : /iPad/.test(ua) ? 'iPad'
        : /Android/.test(ua) ? 'Android'
          : /Windows/.test(ua) ? 'Windows'
            : /Macintosh/.test(ua) ? 'Mac'
              : 'Thiết bị khác';

  const browser =
    /EdgA?\//.test(ua) ? 'Edge'
      : /Chrome\//.test(ua) && !/Edg/.test(ua) ? 'Chrome'
        : /Firefox\//.test(ua) ? 'Firefox'
          : /Safari\//.test(ua) ? 'Safari'
            : 'trình duyệt';

  return `${platform} · ${browser}`;
}

/** Records this device against a person. Document id IS the token, so
 *  re-registering the same browser overwrites instead of piling up rows. */
async function claimToken(token: string, userId: string): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const record: PushToken = {
    token,
    userId,
    deviceLabel: describeDevice(),
    createdAt: now,
    lastSeenAt: now,
  };
  await setDoc(doc(db, 'pushTokens', token), sanitizeForFirestore(record), { merge: true });
}

function isPermissionDenied(err: unknown): boolean {
  return (err as { code?: string } | undefined)?.code === 'permission-denied';
}

export interface EnablePushResult {
  ok: boolean;
  token?: string;
  /** Vietnamese, ready to show. */
  error?: string;
}

/**
 * Asks permission, registers the device, and records the token.
 *
 * Called from a click handler only: browsers ignore (or penalise) a permission
 * prompt that is not tied to a user gesture.
 */
export async function enablePush(userId: string): Promise<EnablePushResult> {
  if (!isPushConfigured()) {
    return { ok: false, error: 'Chưa cấu hình khóa VAPID cho thông báo đẩy.' };
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    return { ok: false, error: 'Trình duyệt này không hỗ trợ thông báo đẩy.' };
  }

  if (needsIosInstall()) {
    return {
      ok: false,
      error: 'Trên iPhone/iPad, cần thêm EduTask vào Màn hình chính trước rồi mở từ đó mới bật được thông báo.',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    return {
      ok: false,
      error: 'Bạn đã chặn thông báo. Hãy mở phần cài đặt quyền của trình duyệt để bật lại.',
    };
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'Chưa được cấp quyền thông báo.' };
  }

  try {
    // The messaging worker is separate from the app's own `sw.js`: mixing FCM's
    // handler into the precache worker would tie push delivery to the shell
    // cache's lifecycle, so each keeps its own scope.
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });

    let token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { ok: false, error: 'Không lấy được mã thiết bị từ Firebase.' };

    try {
      await claimToken(token, userId);
    } catch (err) {
      // The token already belongs to someone else — the shared staffroom PC
      // case, where a colleague used this browser and did not sign out. Rules
      // rightly refuse to reassign it, so discard the token and mint a fresh
      // one for this person rather than fighting over the old one.
      if (!isPermissionDenied(err)) throw err;

      await deleteToken(messaging).catch(() => undefined);
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (!token) return { ok: false, error: 'Không lấy được mã thiết bị mới từ Firebase.' };
      await claimToken(token, userId);
    }

    return { ok: true, token };
  } catch (err) {
    console.error('Failed to enable push notifications:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Không bật được thông báo đẩy.',
    };
  }
}

/** Unregisters this device. The record is removed so nothing is sent to it. */
export async function disablePush(): Promise<boolean> {
  const messaging = await getMessagingInstance();
  if (!messaging) return false;

  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
    if (token) {
      await deleteDoc(doc(db, 'pushTokens', token)).catch(() => undefined);
      await deleteToken(messaging).catch(() => undefined);
    }
    return true;
  } catch (err) {
    console.error('Failed to disable push notifications:', err);
    return false;
  }
}

/**
 * Foreground messages. FCM does NOT raise a system notification while the tab
 * is focused — by design, since the app can show it better itself — so this
 * hands the payload to the in-app toast instead.
 */
export async function onForegroundPush(
  handler: (payload: { title?: string; body?: string }) => void
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, payload => {
    handler({
      title: payload.notification?.title ?? payload.data?.title,
      body: payload.notification?.body ?? payload.data?.body,
    });
  });
}
