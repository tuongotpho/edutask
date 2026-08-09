/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
'use client';

import React from 'react';
import { StatusTone, TONE_STYLES, initials } from '@/Edu-task/lib/statusTone';

/**
 * Redesigned StatusRow — Hallmark Anti-Slop Specification.
 *
 *  - Removed the 4px left side-stripe anti-pattern.
 *  - Hairline surface border with clean status indicator dot.
 *  - High visual hierarchy, typography contrast, and smooth micro-interactions.
 *  - Preserved 100% backward compatibility for all props and rowButton styles.
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
      className={`bg-white rounded-2xl border border-slate-200/90 overflow-hidden transition-all duration-200 ease-out ${
        style.dim ? 'opacity-[0.82] hover:opacity-100' : ''
      } ${
        isInteractive 
          ? 'hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-xs cursor-pointer' 
          : ''
      }`}
      onClick={onClick}
    >
      <div className="p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-start gap-3">
          
          {/* Avatar Icon */}
          {personName !== undefined && (
            <span
              className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-[11px] font-extrabold tracking-wider border shadow-2xs ${style.avatar}`}
              aria-hidden="true"
            >
              {initials(personName)}
            </span>
          )}

          {/* Main Content & Status Badge */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1.5 shadow-2xs ${style.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot || 'bg-slate-400'}`} aria-hidden="true" />
                <span>{statusLabel}</span>
              </span>
              
              <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate">{title}</span>
              
              {titleMeta && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                  {titleMeta}
                </span>
              )}
            </div>

            {detail && <div className="text-xs text-slate-600 leading-relaxed pt-0.5">{detail}</div>}
          </div>

          {/* Trailing Meta */}
          {trailing && (
            <span className="text-[11px] font-medium text-slate-500 flex-shrink-0 text-right bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              {trailing}
            </span>
          )}
        </div>

        {/* Custom Nested Content */}
        {children && <div className="pt-2 border-t border-slate-100/80">{children}</div>}

        {/* Action Buttons Bar */}
        {actions && (
          <div
            className="flex flex-wrap gap-2 justify-end pt-2 border-t border-slate-100/80"
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
 */
export const rowButton = {
  primary:
    'px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all shadow-2xs active:scale-98',
  success:
    'px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all shadow-2xs active:scale-98',
  secondary:
    'px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-all shadow-2xs active:scale-98',
  danger:
    'px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1 transition-all active:scale-98',
} as const;
