'use client';

import React from 'react';
import { PeriodSlot, SCHOOL_SESSIONS, SCHOOL_SESSION_LABELS, SchoolSession } from '@/Edu-task/types/schedule';
import { listPeriods, periodTime } from '@/Edu-task/lib/schedule';
import { useApp } from '@/Edu-task/context/AppContext';

/**
 * Date + buổi + tiết, as one control.
 *
 * Periods are buttons rather than a dropdown so the whole day is visible at
 * once, and so slots already taken can be shown struck through instead of being
 * silently accepted and rejected on save. Being told "that period is busy"
 * while choosing is the difference between a tool people trust and one they
 * work around.
 */

interface SlotPickerProps {
  label: string;
  value: PeriodSlot;
  onChange: (slot: PeriodSlot) => void;
  /** Slots to mark as unavailable, e.g. every period this room is already booked. */
  busySlots?: PeriodSlot[];
  /** Blocks picking a date in the past. */
  minDate?: string;
  hint?: string;
}

export function SlotPicker({ label, value, onChange, busySlots = [], minDate, hint }: SlotPickerProps) {
  const { periodConfig } = useApp();

  const isBusy = (session: SchoolSession, period: number) =>
    busySlots.some(s => s.date === value.date && s.session === session && s.period === period);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-700">{label}</label>

      <input
        type="date"
        value={value.date}
        min={minDate}
        onChange={e => onChange({ ...value, date: e.target.value })}
        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />

      <div className="space-y-2">
        {SCHOOL_SESSIONS.map(session => {
          const periods = listPeriods(periodConfig, session);
          if (periods.length === 0) return null;

          return (
            <div key={session} className="flex items-start gap-2">
              <span className="text-[11px] font-bold text-slate-500 w-12 flex-shrink-0 pt-2">
                {SCHOOL_SESSION_LABELS[session]}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {periods.map(period => {
                  const selected = value.session === session && value.period === period;
                  const busy = isBusy(session, period);
                  const time = periodTime(periodConfig, session, period);

                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => onChange({ ...value, session, period })}
                      title={time ? `${time.start}–${time.end}` : undefined}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        selected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : busy
                            ? 'bg-rose-50 border-rose-200 text-rose-400 line-through'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {period}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {busySlots.length > 0 && (
        <p className="text-[10px] text-rose-500">
          Tiết gạch ngang là đã có lịch. Vẫn chọn được để xem lý do trùng, nhưng sẽ không lưu được.
        </p>
      )}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}
