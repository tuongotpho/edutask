'use client';

import React from 'react';
import { StatusTone, TONE_STYLES, initials } from '@/Edu-task/lib/statusTone';

/**
 * A row in a workflow list — leave requests, tasks, make-up classes, bookings.
 *
 * The layout exists to answer one question in one glance: **does this need me?**
 * Everything is arranged around that.
 *
 *  - The 4px stripe is the first thing the eye meets, before any reading starts.
 *  - The status badge sits FIRST on the line, not last on the right. It used to
 *    be small grey text in the far corner — the position a Vietnamese reader
 *    reaches last, for the single most important fact on the row.
 *  - Settled rows fade. A list of forty records where thirty are finished
 *    should not read as forty things to deal with.
 *  - The avatar gives each person a shape, so a list of one colleague's six
 *    requests stops looking like six identical rows.
 */

interface StatusRowProps {
  tone: StatusTone;
  /** Short, human: "Chờ bạn duyệt", "Đã từ chối". */
  statusLabel: string;
  /** Drives the avatar initials. Omit for rows that are not about a person. */
  personName?: string;
  /** Usually the person's name or the record's subject. */
  title: React.ReactNode;
  /** Small grey text beside the title — department, class, code. */
  titleMeta?: React.ReactNode;
  /** The line under the title: dates, type, room. */
  detail?: React.ReactNode;
  /** Small right-aligned text: step counter, remaining days. */
  trailing?: React.ReactNode;
  /** Buttons. Rendered on their own line so they never squeeze the content. */
  actions?: React.ReactNode;
  /** Extra blocks under the row — an explanation, a decision note. */
  children?: React.ReactNode;
  onClick?: () => void;
}

export function StatusRow({
  tone, statusLabel, personName, title, titleMeta,
  detail, trailing, actions, children, onClick,
}: StatusRowProps) {
  const style = TONE_STYLES[tone];
  const isInteractive = !!onClick;

  return (
    <article
      className={`flex bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all ${
        style.dim ? 'opacity-[0.72] hover:opacity-100' : ''
      } ${isInteractive ? 'hover:border-slate-300 hover:shadow-sm cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className={`w-1 flex-shrink-0 ${style.stripe}`} aria-hidden="true" />

      <div className="flex-1 min-w-0 p-3.5">
        <div className="flex items-start gap-3">
          {personName !== undefined && (
            <span
              className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${style.avatar}`}
              aria-hidden="true"
            >
              {initials(personName)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${style.badge}`}>
                {statusLabel}
              </span>
              <span className="text-xs font-bold text-slate-900 truncate">{title}</span>
              {titleMeta && <span className="text-[11px] text-slate-500">{titleMeta}</span>}
            </div>
            {detail && <div className="text-[11px] text-slate-600 mt-1">{detail}</div>}
          </div>

          {trailing && (
            <span className="text-[11px] text-slate-500 flex-shrink-0 text-right">{trailing}</span>
          )}
        </div>

        {children && <div className="mt-2.5">{children}</div>}

        {actions && (
          <div
            className="flex flex-wrap gap-2 justify-end mt-2.5"
            // Buttons inside a clickable row must not also trigger the row.
            onClick={e => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Shared button styles for row actions.
 *
 * These were redeclared at the bottom of five different tab files with slightly
 * different padding each time. One definition means the buttons in a leave list
 * and a booking list finally look like the same product.
 */
export const rowButton = {
  primary:
    'px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors',
  success:
    'px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors',
  secondary:
    'px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors',
  danger:
    'px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1 transition-colors',
} as const;
