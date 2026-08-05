'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';

interface CollapsibleCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Tailwind colour for the icon, e.g. `text-emerald-600`. */
  iconClassName?: string;
  /** Small pill after the title — a count, a status, anything short. */
  badge?: React.ReactNode;
  /** Open on first render. Collapsed is the default: the admin tab stacks up
   *  a lot of cards and most of them are set once and never touched again. */
  defaultOpen?: boolean;
  /** Action shown on the header row, e.g. "Add". Rendered outside the toggle
   *  button — a button inside a button is invalid — and only while open, since
   *  acting on a section you cannot see is confusing. */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A settings card that folds away.
 *
 * The permission matrix grew its own expand/collapse first; this generalises it
 * so every card on the admin tab behaves the same way instead of that one being
 * the odd one out.
 */
export function CollapsibleCard({
  title,
  subtitle,
  icon: Icon,
  iconClassName = 'text-indigo-600',
  badge,
  defaultOpen = false,
  headerAction,
  children,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex-1 flex items-start gap-2.5 text-left min-w-0 group cursor-pointer"
        >
          {isOpen
            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 group-hover:text-slate-600" />
            : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 group-hover:text-slate-600" />}

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${iconClassName}`} />}
              <span>{title}</span>
              {badge}
            </h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </button>

        {isOpen && headerAction && <div className="flex-shrink-0">{headerAction}</div>}
      </div>

      {isOpen && (
        <div className="border-t border-slate-100 px-5 sm:px-6 py-5 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </section>
  );
}
