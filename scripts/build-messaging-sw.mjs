import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Generates `public/firebase-messaging-sw.js`.
 *
 * A service worker cannot read `process.env` — it is a separate script the
 * browser fetches by URL, never bundled — so its Firebase config has to be
 * baked in. Generating the file keeps the config in one place (`.env.local`)
 * instead of a second hand-maintained copy that silently drifts.
 *
 * The values written here are the public Firebase web config, which already
 * ships inside the client bundle; nothing secret is added by writing it here.
 * The generated file is gitignored anyway, so a fork cannot inherit another
 * school's project id by accident.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(root, '.env.local'), quiet: true });

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  // A warning rather than a hard failure: the rest of the app builds and runs
  // perfectly well without push, and breaking every build over an optional
  // feature would be the wrong trade.
  console.warn(
    `[fcm-sw] Bỏ qua: thiếu ${missing.join(', ')} trong .env.local. ` +
    'Thông báo đẩy sẽ không hoạt động cho tới khi cấu hình đủ.'
  );
}

const worker = `/**
 * GENERATED FILE — do not edit.
 * Produced by scripts/build-messaging-sw.mjs from .env.local.
 *
 * Handles Firebase Cloud Messaging while the app is closed or in the
 * background. Deliberately separate from /sw.js: that worker precaches the app
 * shell, and tying push delivery to the shell cache's lifecycle would mean a
 * cache update could drop notifications.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config, null, 2)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || payload.data?.title || 'EduTask';
  const body = payload.notification?.body || payload.data?.body || '';
  // Notifications about the same record replace each other instead of stacking:
  // three reminders about one overdue task is nagging, not information.
  const tag = payload.data?.tag || 'edutask';

  self.registration.showNotification(title, {
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.data?.url || '/' },
  });
});

// Tapping the notification focuses an open tab rather than opening a second
// copy of the app, then navigates it to the record the notification is about.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
`;

writeFileSync(path.join(root, 'public', 'firebase-messaging-sw.js'), worker, 'utf8');
console.log('[fcm-sw] wrote public/firebase-messaging-sw.js');
