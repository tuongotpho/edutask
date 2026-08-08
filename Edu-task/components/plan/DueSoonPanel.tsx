'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Clock, Calendar, ArrowRight } from 'lucide-react';
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
    <section className="relative bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Accent bar */}
      <div className="h-[3px] bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <BellRing className="w-4 h-4 text-amber-600" />
            </div>
            Sắp Đến Hạn
          </h3>
          {items.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
              {items.length} mục
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1.5 ml-10">
          Công việc trong 3 ngày tới và mốc kế hoạch trong 7 ngày tới
          {personalOnly ? ' liên quan tới bạn' : ' của toàn trường'}.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Không có việc sắp đến hạn</p>
            <p className="text-[11px] text-slate-400 mt-1">Mọi thứ đều đúng tiến độ 🎉</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="relative">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  </span>
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
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Lịch nhắc sắp chạy
            </h4>
            {upcomingSchedules.map(({ reminder, next }) => (
              <div key={reminder.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BellRing className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-slate-700 block">{reminder.title}</span>
                  <span className="text-[10px] text-slate-500">
                    {weekdayLabel(next)} {formatDateVi(next)} lúc {reminder.timeOfDay}
                  </span>
                  <span className="block text-[10px] text-slate-400">{describeRecurrence(reminder)}</span>
                </div>
              </div>
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
      className={`group flex items-start justify-between gap-3 p-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        item.isOverdue
          ? 'bg-gradient-to-r from-rose-50/80 to-red-50/40 border-rose-200 hover:border-rose-300 hover:shadow-rose-100/50'
          : 'bg-gradient-to-r from-amber-50/60 to-orange-50/30 border-amber-200 hover:border-amber-300 hover:shadow-amber-100/50'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {/* Visual type indicator */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
          item.isOverdue
            ? 'bg-rose-100 text-rose-600'
            : 'bg-amber-100 text-amber-600'
        }`}>
          {item.kind === 'TASK' ? <Clock className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              item.kind === 'TASK'
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-600'
                : 'bg-violet-50 border border-violet-200 text-violet-600'
            }`}>
              {item.kind === 'TASK' ? 'CÔNG VIỆC' : 'MỐC KẾ HOẠCH'}
            </span>
            <span className="text-[11px] font-bold text-slate-800 truncate">{item.title}</span>
          </div>
          {item.context && <p className="text-[10px] text-slate-500 mt-0.5">{item.context}</p>}
        </div>
      </div>
      <div className="text-right flex-shrink-0 flex items-center gap-2">
        <div>
          <span className={`text-[11px] font-bold block ${item.isOverdue ? 'text-rose-700' : 'text-amber-700'}`}>
            {when}
          </span>
          <span className="block text-[10px] text-slate-500">{formatDateVi(item.dueDate)}</span>
        </div>
        <ArrowRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
          item.isOverdue ? 'text-rose-400' : 'text-amber-400'
        }`} />
      </div>
    </div>
  );
}
