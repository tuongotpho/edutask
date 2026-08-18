'use client';

import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { isChunkLoadError } from '@/Edu-task/lib/chunkError';

/**
 * What a tab shows when its code could not be downloaded.
 *
 * Every tab in this app is a `next/dynamic` chunk. When that chunk request
 * fails, the import promise rejects, React never mounts the component, and the
 * tab renders NOTHING — no error, no spinner, no way back. The person using it
 * sees a blank panel and reasonably concludes the app has frozen; the only
 * escape is reloading the whole app, which nobody thinks to do because nothing
 * suggested anything went wrong.
 *
 * The service worker now precaches these chunks into the cache it actually
 * reads from, and retries once on a network fault, so this state should be rare.
 * "Rare" is not "never" — a first visit on a bad connection has no cache to fall
 * back on — and the cost of not handling it is a tab that looks broken.
 *
 * Retrying by re-rendering genuinely works: webpack drops a failed chunk from
 * its installed list, so mounting the child again re-requests it rather than
 * replaying the rejected promise. Reloading the page is offered as the second
 * step, for when the failure is not transient.
 */

interface Props {
  children: React.ReactNode;
  /**
   * Change this to clear a previous failure — the tab id, so moving to another
   * tab and back does not keep showing the old error.
   */
  resetKey?: string;
}

interface State {
  error: Error | null;
  attempts: number;
}

export class ChunkErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempts: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Logged rather than swallowed: this used to be invisible, which is most of
    // why it took so long to find.
    console.error('[Tab] Không tải được mã của tab:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, attempts: 0 });
    }
  }

  private retry = () => {
    this.setState(s => ({ error: null, attempts: s.attempts + 1 }));
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { error, attempts } = this.state;
    if (!error) return this.props.children;

    // A genuine bug inside a tab is not this boundary's business — showing
    // "check your connection" for a null-pointer would send someone chasing
    // their wifi. Re-throw so it surfaces as the error it really is.
    if (!isChunkLoadError(error)) throw error;

    const triedAlready = attempts > 0;

    return (
      <div className="bg-white rounded-[5px] border border-slate-200 py-12 px-6 text-center shadow-sm">
        <div className="w-11 h-11 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
          <WifiOff className="w-5 h-5 text-amber-500" />
        </div>

        <p className="text-sm font-bold text-slate-900">Chưa tải được nội dung tab này</p>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
          {triedAlready
            ? 'Vẫn chưa tải được. Nhiều khả năng mạng đang chập chờn, hoặc ứng dụng vừa được cập nhật. Tải lại trang thường xử lý được.'
            : 'Phần mã của tab được tải riêng khi cần, và lần này tải hụt. Dữ liệu của anh/chị không bị ảnh hưởng.'}
        </p>

        <div className="mt-5 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={this.retry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[5px] bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>

          {triedAlready && (
            <button
              type="button"
              onClick={this.reload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[5px] bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-500/10 transition-colors"
            >
              Tải lại trang
            </button>
          )}
        </div>
      </div>
    );
  }
}
