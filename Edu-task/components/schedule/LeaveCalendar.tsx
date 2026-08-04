'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from 'lucide-react';
import { LeaveRequest, LeaveType, LEAVE_TYPE_LABELS, LEAVE_SESSION_LABELS } from '@/Edu-task/types/leave';
import { buildMonthGrid, groupLeavesByDate, toDateKey, WEEKDAY_LABELS, MONTH_LABELS } from '@/Edu-task/lib/calendar';

interface LeaveCalendarProps {
  leaves: LeaveRequest[];
  onSelectLeave?: (leaveId: string) => void;
}

/** Solid dot colours for the legend and the compact mobile markers. */
const LEAVE_TYPE_DOT: Record<LeaveType, string> = {
  PAID: 'bg-blue-500',
  SICK: 'bg-rose-500',
  PERSONAL: 'bg-purple-500',
  BUSINESS: 'bg-emerald-500',
  OTHER: 'bg-amber-500',
};

/** Chip styling for the name pills rendered inside each day cell. */
const LEAVE_TYPE_CHIP: Record<LeaveType, string> = {
  PAID: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
  SICK: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
  PERSONAL: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
  BUSINESS: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  OTHER: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
};

/** The full labels are too long for a legend row. */
const LEAVE_TYPE_SHORT: Record<LeaveType, string> = {
  PAID: 'Phép năm',
  SICK: 'Nghỉ ốm',
  PERSONAL: 'Việc riêng',
  BUSINESS: 'Công tác',
  OTHER: 'Khác',
};

/** Half-day markers, so a morning-only absence is visible at a glance. */
const SESSION_MARK: Record<LeaveRequest['session'], string> = {
  FULL_DAY: '',
  MORNING: 'S',
  AFTERNOON: 'C',
};

/** Beyond this the cell overflows; the rest collapse into a "+N khác" line. */
const MAX_CHIPS_PER_DAY = 2;

/** "Nguyễn Thị Thanh Hà" → "N.T.T. Hà" so a name still fits a narrow cell. */
function shortenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => `${p.charAt(0).toUpperCase()}.`).join('');
  return `${initials} ${last}`;
}

/**
 * Month view of who is away on each day.
 *
 * The card grid elsewhere lists requests as date ranges, which leaves the reader
 * to work out "who is absent next Tuesday" in their head — the exact question
 * you need answered when arranging cover. So each cell names the people who are
 * away rather than only counting them, and a name can be clicked straight
 * through to its request.
 */
export function LeaveCalendar({ leaves, onSelectLeave }: LeaveCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(today));

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth, today), [viewYear, viewMonth, today]);
  const leavesByDate = useMemo(() => groupLeavesByDate(leaves), [leaves]);

  // Summary of the month currently on screen, so leadership can see the load
  // without clicking through every day.
  const monthStats = useMemo(() => {
    const seen = new Set<string>();
    let daysWithAbsence = 0;
    let missingSubstitute = 0;

    for (const cell of cells) {
      if (!cell.date) continue;
      const dayLeaves = leavesByDate.get(cell.date);
      if (!dayLeaves || dayLeaves.length === 0) continue;
      daysWithAbsence++;
      for (const leave of dayLeaves) {
        if (seen.has(leave.id)) continue;
        seen.add(leave.id);
        if (!leave.substituteTeacherName) missingSubstitute++;
      }
    }
    return { totalLeaves: seen.size, daysWithAbsence, missingSubstitute };
  }, [cells, leavesByDate]);

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
    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
      {/* Month navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            {MONTH_LABELS[viewMonth]} / {viewYear}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {monthStats.totalLeaves === 0 ? (
              'Không có đơn nghỉ nào trong tháng này.'
            ) : (
              <>
                <strong className="text-slate-700">{monthStats.totalLeaves}</strong> đơn nghỉ ·{' '}
                <strong className="text-slate-700">{monthStats.daysWithAbsence}</strong> ngày có người vắng
                {monthStats.missingSubstitute > 0 && (
                  <span className="text-rose-600 font-semibold"> · {monthStats.missingSubstitute} đơn chưa có người dạy thay</span>
                )}
              </>
            )}
          </p>
        </div>
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500 border-y border-slate-100 py-2">
        {(Object.keys(LEAVE_TYPE_SHORT) as LeaveType[]).map(type => (
          <span key={type} className="flex items-center gap-1 font-semibold">
            <span className={`w-2 h-2 rounded-full ${LEAVE_TYPE_DOT[type]}`} />
            {LEAVE_TYPE_SHORT[type]}
          </span>
        ))}
        <span className="flex items-center gap-1 font-semibold text-slate-400">
          <span className="px-1 rounded border border-dashed border-slate-400 text-[9px] leading-3">S/C</span>
          Nghỉ nửa buổi
        </span>
        <span className="flex items-center gap-1 font-semibold text-rose-500">
          <AlertTriangle className="w-3 h-3" />
          Chưa có người dạy thay
        </span>
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
          if (!cell.date) return <div key={`blank-${idx}`} className="min-h-[64px] sm:min-h-[96px]" />;

          const date = cell.date;
          const dayLeaves = leavesByDate.get(date) ?? [];
          const isSelected = selectedDate === date;
          const count = dayLeaves.length;
          const visibleLeaves = dayLeaves.slice(0, MAX_CHIPS_PER_DAY);
          const hiddenCount = count - visibleLeaves.length;

          return (
            <div
              key={date}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Ngày ${date.split('-').reverse().join('/')}${count > 0 ? `, ${count} người nghỉ` : ', không có ai nghỉ'}`}
              onClick={() => setSelectedDate(date)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedDate(date);
                }
              }}
              className={`min-h-[64px] sm:min-h-[96px] rounded-xl border p-1 sm:p-1.5 flex flex-col gap-1 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400/40 ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-400/30'
                  : count > 0
                  ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/80'
                  : cell.isWeekend
                  ? 'border-slate-100 bg-slate-50/60 hover:bg-slate-100'
                  : 'border-slate-100 hover:bg-slate-50'
              }`}
            >
              {/* Day number + total for the day */}
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[11px] font-bold leading-5 ${
                  cell.isToday
                    ? 'w-5 h-5 rounded-full bg-indigo-600 text-white text-center'
                    : cell.isWeekend
                    ? 'text-slate-400'
                    : 'text-slate-700'
                }`}>
                  {Number(date.slice(-2))}
                </span>
                {count > 0 && (
                  <span className="px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-4">
                    {count}
                  </span>
                )}
              </div>

              {/* Named chips — the actual upgrade over a bare count */}
              <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                {visibleLeaves.map(leave => (
                  <button
                    key={leave.id}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onSelectLeave?.(leave.id);
                    }}
                    title={`${leave.applicantName} — ${leave.departmentName} · ${LEAVE_TYPE_LABELS[leave.leaveType].label} · ${LEAVE_SESSION_LABELS[leave.session]}${
                      leave.substituteTeacherName ? ` · Dạy thay: ${leave.substituteTeacherName}` : ' · Chưa phân công dạy thay'
                    }`}
                    className={`w-full px-1 py-0.5 rounded-md border text-[9px] font-bold leading-tight flex items-center gap-0.5 min-w-0 transition-colors ${
                      LEAVE_TYPE_CHIP[leave.leaveType]
                    } ${leave.overallStatus === 'IN_REVIEW' ? 'border-dashed opacity-80' : ''}`}
                  >
                    {!leave.substituteTeacherName && (
                      <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 text-rose-500" />
                    )}
                    <span className="truncate">{shortenName(leave.applicantName)}</span>
                    {SESSION_MARK[leave.session] && (
                      <span className="ml-auto flex-shrink-0 opacity-70">{SESSION_MARK[leave.session]}</span>
                    )}
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <span className="text-[9px] font-bold text-slate-500 pl-1">+{hiddenCount} người khác</span>
                )}
              </div>

              {/* Cells are too narrow for names on phones, so fall back to dots */}
              <div className="sm:hidden flex flex-wrap gap-0.5 mt-auto">
                {dayLeaves.slice(0, 4).map(leave => (
                  <span key={leave.id} className={`w-1.5 h-1.5 rounded-full ${LEAVE_TYPE_DOT[leave.leaveType]}`} />
                ))}
              </div>
            </div>
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
