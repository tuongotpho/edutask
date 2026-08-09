'use client';

import React, { useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { SCHOOL_SESSIONS, SCHOOL_SESSION_LABELS } from '@/Edu-task/types/schedule';
import {
  formatDateVi,
  listPeriods,
  sortRooms,
  toDateString,
  weekdayLabel,
} from '@/Edu-task/lib/schedule';
import {
  occupanciesFromBookings,
  occupanciesFromMakeups,
} from '@/Edu-task/lib/slotConflict';

/**
 * Which rooms are busy, at a glance, for one day.
 *
 * A grid rather than a list: the question people actually have is "is anything
 * free at tiết 3", and a list of bookings makes you reconstruct that in your
 * head. Make-up classes appear here too — a room held by a make-up lesson is
 * just as unavailable as one held by a booking, and showing only bookings would
 * make the grid quietly lie.
 */
export function RoomTimetable() {
  const { rooms, bookings, makeups, periodConfig } = useApp();

  const [date, setDate] = useState(toDateString(new Date()));

  const activeRooms = useMemo(() => sortRooms(rooms).filter(r => r.isActive), [rooms]);

  // Keyed by `roomId|session|period` for O(1) cell lookup.
  const occupancyByCell = useMemo(() => {
    const map = new Map<string, string>();
    for (const occupancy of [...occupanciesFromBookings(bookings), ...occupanciesFromMakeups(makeups)]) {
      if (!occupancy.roomId || occupancy.slot.date !== date) continue;
      map.set(`${occupancy.roomId}|${occupancy.slot.session}|${occupancy.slot.period}`, occupancy.label);
    }
    return map;
  }, [bookings, makeups, date]);

  const busyCount = occupancyByCell.size;

  return (
    <div className="bg-white rounded-[5px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-emerald-600" />
            Lịch Sử Dụng Phòng
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {weekdayLabel(date)} {formatDateVi(date)} · {busyCount} lượt sử dụng
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="p-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {activeRooms.length === 0 ? (
        <p className="p-6 text-xs text-slate-500 text-center">
          Chưa có phòng nào trong danh mục.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-2 text-left font-bold text-slate-700 sticky left-0 bg-slate-50 min-w-[140px]">
                  Phòng
                </th>
                {SCHOOL_SESSIONS.map(session =>
                  listPeriods(periodConfig, session).map(period => (
                    <th
                      key={`${session}-${period}`}
                      className={`p-2 font-bold text-slate-600 text-center min-w-[52px] ${
                        session === 'AFTERNOON' && period === 1 ? 'border-l-2 border-slate-300' : ''
                      }`}
                    >
                      <span className="block text-[9px] text-slate-400 font-medium">
                        {SCHOOL_SESSION_LABELS[session]}
                      </span>
                      {period}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {activeRooms.map(room => (
                <tr key={room.id} className="border-t border-slate-100">
                  <td className="p-2 font-bold text-slate-800 sticky left-0 bg-white">
                    {room.name}
                    {room.requiresApproval && (
                      <span className="block text-[9px] text-amber-600 font-medium">cần duyệt</span>
                    )}
                  </td>
                  {SCHOOL_SESSIONS.map(session =>
                    listPeriods(periodConfig, session).map(period => {
                      const label = occupancyByCell.get(`${room.id}|${session}|${period}`);
                      return (
                        <td
                          key={`${session}-${period}`}
                          title={label}
                          className={`p-1.5 text-center ${
                            session === 'AFTERNOON' && period === 1 ? 'border-l-2 border-slate-300' : ''
                          }`}
                        >
                          <span
                            className={`block w-full h-6 rounded-md ${
                              label ? 'bg-emerald-500' : 'bg-slate-100'
                            }`}
                          />
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded bg-emerald-500 inline-block" /> Đã có lịch
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded bg-slate-100 inline-block" /> Còn trống
        </span>
        <span className="ml-auto">Di chuột lên ô để xem ai đang dùng.</span>
      </div>
    </div>
  );
}
