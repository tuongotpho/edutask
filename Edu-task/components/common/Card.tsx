'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * The section container.
 *
 * The string `bg-white rounded-3xl border border-slate-200 shadow-sm` appeared
 * 56 times across 18 files. That is why every screen looked the same AND why
 * changing anything meant touching eighteen files — one cause, two symptoms.
 *
 * `accent` is what gives each tab its own identity. The modules already had
 * colours (indigo for tasks, emerald for rooms, amber for the lateness log…)
 * but only inside icons, so switching tabs looked identical. Running the accent
 * along the card header means a glance tells you where you are.
 */

export type CardAccent =
  | 'none'
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'violet'
  | 'sky'
  | 'rose';

const ACCENT_BAR: Record<CardAccent, string> = {
  none: '',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
};

const ACCENT_ICON: Record<CardAccent, string> = {
  none: 'text-slate-400',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  violet: 'text-violet-600',
  sky: 'text-sky-600',
  rose: 'text-rose-600',
};

interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  accent?: CardAccent;
  /** Right-hand side of the header — a button, a filter, a count. */
  actions?: React.ReactNode;
  /**
   * Drop the body padding. For cards whose content manages its own edges:
   * tables that must bleed to the border, lists with their own dividers.
   */
  flush?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Card({
  title, subtitle, icon: Icon, accent = 'none',
  actions, flush = false, className = '', children,
}: CardProps) {
  const hasHeader = !!title || !!actions;

  return (
    <section className={`bg-white rounded-[5px] border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* A 3px accent along the top edge rather than a tinted background: it
          identifies the module without competing with the status colours
          inside, which are the ones that carry urgency. */}
      {accent !== 'none' && <div className={`h-[3px] ${ACCENT_BAR[accent]}`} />}

      {hasHeader && (
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${ACCENT_ICON[accent]}`} />}
                <span>{title}</span>
              </h3>
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      )}

      {children !== undefined && (
        <div className={flush ? '' : `px-5 sm:px-6 ${hasHeader ? 'pb-5' : 'py-5'}`}>
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * The page heading that opens most tabs — title, one line of explanation, and
 * usually a row of sub-view buttons underneath.
 */
export function TabHeader({
  title, subtitle, accent = 'none', actions, children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  accent?: CardAccent;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card accent={accent} flush>
      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </Card>
  );
}

/** What a list shows when it has nothing in it. */
export function EmptyState({
  icon: Icon, message, hint,
}: {
  icon?: LucideIcon;
  message: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[5px] border border-slate-200 py-12 px-6 text-center shadow-sm">
      {Icon && (
        <div className="w-11 h-11 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-slate-300" />
        </div>
      )}
      <p className="text-xs text-slate-500">{message}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-1.5 max-w-sm mx-auto">{hint}</p>}
    </div>
  );
}
