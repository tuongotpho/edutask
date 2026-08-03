'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { LeaveRequest, LEAVE_TYPE_LABELS, LEAVE_SESSION_LABELS } from '@/Edu-task/types/leave';
import { buildMonthGrid, groupLeavesByDate, toDateKey, WEEKDAY_LABELS, MONTH_LABELS } from '@/Edu-task/lib/calendar';

interface LeaveCalendarProps {
  leaves: LeaveRequest[];
  onSelectLeave?: (leaveId: string) => void;
}

/**
 * Month view of who is away on each day.
 *
 * The card grid elsewhere lists requests as date ranges, which leaves the reader
 * to work out "who is absent next Tuesday" in their head — the exact question
 * you need answered when arranging cover.
 */
export function LeaveCalendar({ leaves, onSelectLeave }: LeaveCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(today));

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth, today), [viewYear, viewMonth, today]);
  const leavesByDate = useMemo(() => groupLeavesByDate(leaves), [leaves]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(toDateKey(today));
  };

  const selectedLeaves = selectedDate ? leavesByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-600" />
          {MONTH_LABELS[viewMonth]} / {viewYear}
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Tháng trước"
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Tháng sau"
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.date) return <div key={`blank-${idx}`} className="aspect-square" />;

          const dayLeaves = leavesByDate.get(cell.date) ?? [];
          const isSelected = selectedDate === cell.date;
          const count = dayLeaves.length;

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelectedDate(cell.date)}
              className={`aspect-square rounded-xl border p-1 flex flex-col items-center justify-center transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-400/30'
                  : cell.isToday
                  ? 'border-indigo-300 bg-indigo-50/40'
                  : count > 0
                  ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-100/60'
                  : cell.isWeekend
                  ? 'border-slate-100 bg-slate-50/60 hover:bg-slate-100'
                  : 'border-slate-100 hover:bg-slate-50'
              }`}
            >
              <span className={`text-xs font-bold ${
                cell.isToday ? 'text-indigo-700' : cell.isWeekend ? 'text-slate-400' : 'text-slate-700'
              }`}>
                {Number(cell.date.slice(-2))}
              </span>
              {count > 0 && (
                <span className="mt-0.5 px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-4">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail for the selected day */}
      <div className="pt-3 border-t border-slate-100">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          {selectedDate
            ? `Nghỉ phép ngày ${selectedDate.split('-').reverse().join('/')} (${selectedLeaves.length})`
            : 'Chọn một ngày để xem chi tiết'}
        </div>

        {selectedLeaves.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Không có ai nghỉ trong ngày này.</p>
        ) : (
          <ul className="space-y-1.5">
            {selectedLeaves.map(leave => (
              <li key={leave.id}>
                <button
                  type="button"
                  onClick={() => onSelectLeave?.(leave.id)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white hover:border-indigo-300 transition-all text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 truncate">{leave.applicantName}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${LEAVE_TYPE_LABELS[leave.leaveType].bg}`}>
                      {LEAVE_TYPE_LABELS[leave.leaveType].label}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {leave.departmentName} · {LEAVE_SESSION_LABELS[leave.session]}
                    {leave.overallStatus === 'IN_REVIEW' && (
                      <span className="ml-1 text-amber-600 font-bold">· đang chờ duyệt</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {leave.substituteTeacherName
                      ? <>Dạy thay: <strong className="text-emerald-700">{leave.substituteTeacherName}</strong></>
                      : <span className="text-rose-600 font-bold">⚠️ Chưa phân công dạy thay</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
