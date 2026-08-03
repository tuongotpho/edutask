'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Connectivity as an external store. `useSyncExternalStore` is the idiomatic way
 * to read browser state that React does not own — reading it in an effect would
 * cause an extra render pass and briefly show the wrong state.
 */
function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getIsOffline = () => !navigator.onLine;
// During prerender there is no navigator; assume online so the banner never
// appears in the exported HTML.
const getIsOfflineServer = () => false;

/**
 * Registers the service worker and warns when the device goes offline.
 *
 * The offline banner matters here because the app is write-through: every save
 * goes straight to Firestore and is rolled back if it fails. Without the banner
 * a teacher would only discover the problem after filling in a whole form.
 */
export function PwaProvider() {
  const isOffline = useSyncExternalStore(subscribeToConnectivity, getIsOffline, getIsOfflineServer);
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Registering during development would cache half-built assets.
    if (process.env.NODE_ENV !== 'production') return;

    let cancelled = false;

    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        if (cancelled) return;

        // A worker already waiting means a newer build is sitting ready.
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateReady(true);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // `controller` is null on the very first install; only an update
            // that replaces a running worker is worth interrupting the user for.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(err => console.error('Service worker registration failed:', err));

    return () => { cancelled = true; };
  }, []);

  const applyUpdate = () => {
    waitingWorker?.postMessage('SKIP_WAITING');
    // The new worker takes control on reload.
    window.location.reload();
  };

  if (!isOffline && !updateReady) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[110] flex flex-col items-center gap-1 p-2 pointer-events-none">
      {isOffline && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-lg"
        >
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>Đang ngoại tuyến — bạn vẫn xem được dữ liệu đã tải, nhưng chưa lưu được thay đổi.</span>
        </div>
      )}

      {updateReady && (
        <button
          type="button"
          onClick={applyUpdate}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          <span>Đã có phiên bản mới — bấm để cập nhật</span>
        </button>
      )}
    </div>
  );
}
