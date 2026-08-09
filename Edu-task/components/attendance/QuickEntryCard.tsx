'use client';

import React, { useMemo, useState } from 'react';
import { Check, Clock, Zap } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  ATTENDANCE_ISSUES,
  ATTENDANCE_ISSUE_LABELS,
  AttendanceIssue,
  TIMED_ISSUES,
} from '@/Edu-task/types/attendance';
import { PeriodSlot, SCHOOL_SESSIONS, SCHOOL_SESSION_LABELS } from '@/Edu-task/types/schedule';
import {
  currentPeriod,
  formatPeriodWithTime,
  listPeriods,
  sortClasses,
  toDateString,
} from '@/Edu-task/lib/schedule';

/**
 * The supervisor's entry form, designed for a phone held in one hand while
 * walking a corridor.
 *
 * Everything that can be guessed is pre-filled — today's date, and the period
 * that is running right now — because the alternative is picking four dropdowns
 * per entry, and a form that takes thirty seconds during a lesson change simply
 * does not get used. Everything is a tap target, not a dropdown, for the same
 * reason.
 *
 * Deliberately NOT pre-filled: the teacher. There is no timetable in the
 * system, so the app cannot know who should be in 10A1 at tiết 3, and guessing
 * would put the wrong name on a disciplinary record.
 */

const CHIP_BASE =
  'px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95';
const CHIP_ON = 'bg-slate-900 border-slate-900 text-white';
const CHIP_OFF = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';

/** Most late arrivals are a handful of minutes; typing a number is friction. */
const MINUTE_PRESETS = [5, 10, 15, 20, 30];

export function QuickEntryCard() {
  const { classes, users, periodConfig, recordIssue, showToast } = useApp();

  const today = toDateString(new Date());
  const suggested = useMemo(() => currentPeriod(periodConfig), [periodConfig]);

  const [slot, setSlot] = useState<PeriodSlot>({
    date: today,
    session: suggested?.session ?? 'MORNING',
    period: suggested?.period ?? 1,
  });
  const [classId, setClassId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [issue, setIssue] = useState<AttendanceIssue>('LATE');
  const [minutes, setMinutes] = useState<number>(5);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activeClasses = useMemo(() => sortClasses(classes).filter(c => c.isActive), [classes]);
  const teachers = useMemo(
    () =>
      users
        .filter(u => u.status === 'ACTIVE' && u.isTeachingStaff)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
    [users]
  );

  const needsMinutes = TIMED_ISSUES.includes(issue);
  // A class with no teacher is the one case where the name may legitimately be
  // unknown — the supervisor sees an empty room and cannot say who was due.
  const teacherOptional = issue === 'EMPTY_CLASS';
  const canSubmit = !!classId && (teacherOptional || !!teacherId);

  const reset = () => {
    setClassId('');
    setTeacherId('');
    setNote('');
    setMinutes(5);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const created = await recordIssue({
        slot,
        classId,
        teacherId: teacherId || undefined,
        issue,
        minutes: needsMinutes ? minutes : undefined,
        note,
      });
      if (created) {
        showToast('success', `Đã ghi nhận ${created.code}. Giáo viên đã được thông báo.`);
        // Keep the slot: a supervisor doing a round records several classes in
        // the same period, so clearing it would mean re-picking every time.
        reset();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-[5px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          Ghi Nhận Nhanh
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {suggested
            ? `Đã tự chọn ${formatPeriodWithTime(periodConfig, suggested.session, suggested.period)}.`
            : 'Ngoài giờ học — vui lòng chọn tiết thủ công.'}
        </p>
      </div>

      <div className="p-5 space-y-4">

        {/* Ngày + tiết */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">Thời điểm</label>
          <input
            type="date"
            value={slot.date}
            onChange={e => setSlot({ ...slot, date: e.target.value })}
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          {SCHOOL_SESSIONS.map(session => {
            const periods = listPeriods(periodConfig, session);
            if (periods.length === 0) return null;
            return (
              <div key={session} className="flex items-start gap-2">
                <span className="text-[11px] font-bold text-slate-500 w-12 flex-shrink-0 pt-2.5">
                  {SCHOOL_SESSION_LABELS[session]}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {periods.map(period => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSlot({ ...slot, session, period })}
                      className={`${CHIP_BASE} min-w-[38px] ${
                        slot.session === session && slot.period === period ? CHIP_ON : CHIP_OFF
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lớp */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">Lớp</label>
          {activeClasses.length === 0 ? (
            <p className="text-[11px] text-amber-700 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              Danh mục lớp đang trống. Quản trị viên cần thêm lớp trước.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeClasses.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClassId(classId === c.id ? '' : c.id)}
                  className={`${CHIP_BASE} ${classId === c.id ? CHIP_ON : CHIP_OFF}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loại vi phạm */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">Nội dung</label>
          <div className="flex flex-wrap gap-1.5">
            {ATTENDANCE_ISSUES.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setIssue(option)}
                className={`${CHIP_BASE} ${issue === option ? CHIP_ON : CHIP_OFF}`}
              >
                {ATTENDANCE_ISSUE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {/* Số phút */}
        {needsMinutes && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Số phút
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {MINUTE_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMinutes(preset)}
                  className={`${CHIP_BASE} min-w-[44px] ${minutes === preset ? CHIP_ON : CHIP_OFF}`}
                >
                  {preset}′
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={180}
                value={minutes}
                onChange={e => setMinutes(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 p-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        )}

        {/* Giáo viên */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Giáo viên {teacherOptional && <span className="font-normal text-slate-400">(có thể bỏ trống)</span>}
          </label>
          <select
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="">
              {teacherOptional ? '— Chưa xác định được giáo viên —' : '— Chọn giáo viên —'}
            </option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>
                {t.fullName} · {t.departmentName}
              </option>
            ))}
          </select>
          {teacherOptional && !teacherId && (
            <p className="text-[10px] text-slate-400">
              Bản ghi vẫn được lưu để tính vào thống kê chung, nhưng sẽ không quy cho ai.
            </p>
          )}
        </div>

        {/* Ghi chú */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Tùy chọn"
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <button
          type="button"
          disabled={!canSubmit || isSaving}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
        >
          <Check className="w-4 h-4" />
          <span>{isSaving ? 'Đang lưu…' : 'Ghi Nhận'}</span>
        </button>

        <p className="text-[10px] text-slate-400 text-center">
          Giáo viên được thông báo ngay và có quyền gửi giải trình.
        </p>
      </div>
    </section>
  );
}
