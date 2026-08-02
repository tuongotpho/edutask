'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export type ToastKind = 'success' | 'error';

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
}

/**
 * Fixed-position stack of transient messages. Rendered once, near the root, so
 * any part of the app can report the outcome of a write without owning UI.
 */
export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map(toast => {
        const isError = toast.kind === 'error';
        return (
          <div
            key={toast.id}
            role="status"
            aria-live={isError ? 'assertive' : 'polite'}
            className={`flex items-start gap-2.5 p-3.5 rounded-2xl border shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              isError
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-relaxed">{toast.text}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Đóng thông báo"
              className={`p-0.5 rounded-lg flex-shrink-0 transition-colors ${
                isError ? 'hover:bg-rose-100 text-rose-500' : 'hover:bg-emerald-100 text-emerald-600'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
