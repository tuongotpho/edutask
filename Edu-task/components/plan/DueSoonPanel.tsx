'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { formatDateVi, toDateString, weekdayLabel } from '@/Edu-task/lib/schedule';
import {
  DueItem,
  dueItemsForUser,
  nextOccurrence,
  upcomingMilestones,
  upcomingTaskReminders,
} from '@/Edu-task/lib/reminderSchedule';
import { describeRecurrence } from '@/Edu-task/lib/reminderSchedule';

/**
 * "Sắp đến hạn" — the in-app half of the reminder system.
 *
 * This works today, with no server: the same pure functions the scheduled
 * Cloud Function will call are run in the browser against data already
 * subscribed. Push notification adds reach — telling someone who has not opened
 * the app — but the reckoning of *what* is due is identical, and shipping it
 * now means the feature is useful before the billing account is upgraded.
 */

interface DueSoonPanelProps {
  /** Show only this person's items, rather than everything in scope. */
  personalOnly?: boolean;
}

export function DueSoonPanel({ personalOnly = true }: DueSoonPanelProps) {
  const { currentUser, tasks, plans, reminders } = useApp();

  const today = toDateString(new Date());

  const items = useMemo(() => {
    const all = [
      ...upcomingTaskReminders(tasks, today, 3),
      ...upcomingMilestones(plans, today, 7),
    ];
    const scoped = personalOnly && currentUser ? dueItemsForUser(all, currentUser.id) : all;
    return scoped.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, plans, today, personalOnly, currentUser]);

  // The next few scheduled reminders, so people can see what is coming and why.
  const upcomingSchedules = useMemo(
    () =>
      reminders
        .filter(r => r.isActive)
        .map(r => ({ reminder: r, next: nextOccurrence(r, today) }))
        .filter((entry): entry is { reminder: typeof entry.reminder; next: string } => !!entry.next)
        .sort((a, b) => a.next.localeCompare(b.next))
        .slice(0, 3),
    [reminders, today]
  );

  const overdue = items.filter(i => i.isOverdue);
  const soon = items.filter(i => !i.isOverdue);

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <BellRing className="w-4 h-4 text-amber-500" />
          Sắp Đến Hạn
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Công việc trong 3 ngày tới và mốc kế hoạch trong 7 ngày tới
          {personalOnly ? ' liên quan tới bạn' : ' của toàn trường'}.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {items.length === 0 ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Không có việc nào sắp đến hạn. </p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Đã quá hạn ({overdue.length})
                </h4>
                {overdue.map(item => <DueRow key={`${item.kind}-${item.id}`} item={item} />)}
              </div>
            )}

            {soon.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Sắp tới ({soon.length})
                </h4>
                {soon.map(item => <DueRow key={`${item.kind}-${item.id}`} item={item} />)}
              </div>
            )}
          </>
        )}

        {upcomingSchedules.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Lịch nhắc sắp chạy
            </h4>
            {upcomingSchedules.map(({ reminder, next }) => (
              <p key={reminder.id} className="text-[11px] text-slate-600">
                <span className="font-semibold">{reminder.title}</span>
                {' — '}
                {weekdayLabel(next)} {formatDateVi(next)} lúc {reminder.timeOfDay}
                <span className="block text-[10px] text-slate-400">{describeRecurrence(reminder)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DueRow({ item }: { item: DueItem }) {
  const days = item.daysRemaining;
  const when =
    days < 0 ? `trễ ${Math.abs(days)} ngày`
      : days === 0 ? 'hôm nay'
        : days === 1 ? 'ngày mai'
          : `còn ${days} ngày`;

  return (
    <div
      className={`flex items-start justify-between gap-3 p-2.5 rounded-xl border ${
        item.isOverdue ? 'bg-rose-50/60 border-rose-200' : 'bg-amber-50/50 border-amber-200'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white border border-slate-200 text-slate-600">
            {item.kind === 'TASK' ? 'CÔNG VIỆC' : 'MỐC KẾ HOẠCH'}
          </span>
          <span className="text-[11px] font-bold text-slate-800">{item.title}</span>
        </div>
        {item.context && <p className="text-[10px] text-slate-500 mt-0.5">{item.context}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <span className={`text-[11px] font-bold ${item.isOverdue ? 'text-rose-700' : 'text-amber-700'}`}>
          {when}
        </span>
        <span className="block text-[10px] text-slate-500">{formatDateVi(item.dueDate)}</span>
      </div>
    </div>
  );
}
