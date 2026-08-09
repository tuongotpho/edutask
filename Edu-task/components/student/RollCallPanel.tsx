'use client';

import React, { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Loader2, Users } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  STUDENT_MARKS,
  STUDENT_MARK_LABELS,
  StudentAttendanceEntry,
  StudentMark,
} from '@/Edu-task/types/student';
import { SCHOOL_SESSIONS, SCHOOL_SESSION_LABELS, SchoolSession } from '@/Edu-task/types/schedule';
import { formatDateVi, isWeekend, sortClasses, toDateString, weekdayLabel } from '@/Edu-task/lib/schedule';
import { tallyEntries } from '@/Edu-task/lib/studentStats';

/**
 * Điểm danh lớp.
 *
 * The sheet opens with everyone marked present and the teacher only touches
 * the exceptions — a register that starts blank forces forty taps to record
 * "nobody is missing", which is the normal case, and a register that takes two
 * minutes a day does not get filled in.
 *
 * Nothing is written until Save. Marking is local state so a teacher can
 * correct a mis-tap without a round trip, and so a half-finished roll never
 * reaches the dashboard as if it were complete.
 */
export function RollCallPanel() {
  const { classes, students, findRoll, buildRoll, saveRoll, showToast } = useApp();

  const today = toDateString(new Date());
  const activeClasses = useMemo(() => sortClasses(classes).filter(c => c.isActive), [classes]);

  const [classId, setClassId] = useState(activeClasses[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [session, setSession] = useState<SchoolSession>('MORNING');

  const saved = classId ? findRoll(classId, date, session) : null;
  const rosterSize = students.filter(s => s.classId === classId && s.isActive).length;

  return (
    <section className="bg-white rounded-[5px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-sky-600" />
          Điểm Danh Lớp
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {weekdayLabel(date)} {formatDateVi(date)}
          {isWeekend(date) && <span className="ml-2 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium text-[11px] border border-amber-200">Ngày nghỉ</span>}
          {saved && ` · đã điểm danh bởi ${saved.recordedByName}`}
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lớp</label>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="">— Chọn lớp —</option>
              {activeClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ngày</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Buổi</label>
            <div className="flex gap-1.5">
              {SCHOOL_SESSIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSession(option)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    session === option
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {SCHOOL_SESSION_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!classId ? (
          <p className="text-xs text-slate-500 py-6 text-center">Chọn lớp để bắt đầu điểm danh.</p>
        ) : (
          // Remounted on every change of class/date/session. That `key` is what
          // lets the sheet initialise its state from the roll it is given
          // instead of syncing through an effect — the same pattern the leave
          // and task modals use. It also means a teacher's unsaved marks can
          // never be silently overwritten by an unrelated Firestore snapshot.
          <RollSheet
            key={`${classId}-${date}-${session}`}
            initialEntries={buildRoll(classId, date, session)}
            rosterSize={rosterSize}
            isUpdate={!!saved}
            onSave={entries => saveRoll(classId, date, session, entries)}
            onSaved={absentCount =>
              showToast(
                'success',
                absentCount === 0
                  ? 'Đã lưu điểm danh — lớp đủ sĩ số.'
                  : `Đã lưu điểm danh — vắng ${absentCount} em.`
              )
            }
          />
        )}
      </div>
    </section>
  );
}

/**
 * The editable sheet.
 *
 * Split out purely so its state can be initialised from a prop and reset by
 * remounting. Marks live here and are written only on save, so a mis-tap costs
 * nothing and a half-finished roll never reaches the dashboard.
 */
function RollSheet({
  initialEntries, rosterSize, isUpdate, onSave, onSaved,
}: {
  initialEntries: StudentAttendanceEntry[];
  rosterSize: number;
  isUpdate: boolean;
  onSave: (entries: StudentAttendanceEntry[]) => Promise<boolean>;
  onSaved: (absentCount: number) => void;
}) {
  const [entries, setEntries] = useState<StudentAttendanceEntry[]>(initialEntries);
  const [isSaving, setIsSaving] = useState(false);

  const setMark = (studentId: string, mark: StudentMark) => {
    setEntries(prev =>
      prev.map(item =>
        item.studentId === studentId
          ? {
              ...item,
              mark,
              // Minutes belong to LATE alone, or a corrected mark would leave
              // "nghỉ có phép, muộn 10 phút" in the record.
              minutesLate: mark === 'LATE' ? (item.minutesLate ?? 5) : undefined,
            }
          : item
      )
    );
  };

  const tally = tallyEntries(entries);

  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-amber-800 p-3 rounded-xl bg-amber-50 border border-amber-200">
        Lớp này chưa có học sinh nào trong danh sách. Vào mục <strong>Hồ Sơ Học Sinh</strong> để
        thêm, hoặc nhờ văn thư nhập danh sách lớp.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Pill label="Sĩ số" value={rosterSize} tone="slate" />
          <Pill label="Có mặt" value={tally.presentCount} tone="emerald" />
          <Pill label="Vắng" value={tally.absentCount} tone="rose" />
          {tally.lateCount > 0 && <Pill label="Muộn" value={tally.lateCount} tone="amber" />}
        </div>
        <button
          type="button"
          onClick={() =>
            setEntries(prev =>
              prev.map(item => ({ ...item, mark: 'PRESENT' as StudentMark, minutesLate: undefined }))
            )
          }
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px]"
        >
          Đặt lại tất cả có mặt
        </button>
      </div>

      <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1 mt-3">
        {entries.map((item, index) => (
          <div
            key={item.studentId}
            className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border flex-wrap ${
              item.mark === 'PRESENT'
                ? 'bg-white border-slate-200'
                : STUDENT_MARK_LABELS[item.mark].bg
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 w-5 flex-shrink-0">{index + 1}</span>
              <span className="text-[11px] font-bold text-slate-800 truncate">{item.studentName}</span>
            </div>

            <div className="flex flex-wrap gap-1 items-center">
              {STUDENT_MARKS.map(mark => {
                const config = STUDENT_MARK_LABELS[mark];
                return (
                  <button
                    key={mark}
                    type="button"
                    onClick={() => setMark(item.studentId, mark)}
                    title={config.label}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      item.mark === mark
                        ? `${config.bg} ${config.color}`
                        : 'bg-white border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {config.short}
                  </button>
                );
              })}
              {item.mark === 'LATE' && (
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={item.minutesLate ?? 5}
                  onChange={e =>
                    setEntries(prev =>
                      prev.map(row =>
                        row.studentId === item.studentId
                          ? { ...row, minutesLate: Math.max(1, Number(e.target.value) || 1) }
                          : row
                      )
                    )
                  }
                  className="w-14 p-1 rounded-lg border border-slate-200 text-[10px] font-bold"
                  aria-label={`Số phút muộn của ${item.studentName}`}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-3">
        <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          CM: có mặt · M: đi muộn · P: nghỉ có phép · K: nghỉ không phép
        </p>
        <button
          type="button"
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true);
            try {
              if (await onSave(entries)) onSaved(tally.absentCount);
            } finally {
              setIsSaving(false);
            }
          }}
          className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{isSaving ? 'Đang lưu…' : isUpdate ? 'Cập Nhật Điểm Danh' : 'Lưu Điểm Danh'}</span>
        </button>
      </div>
    </>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'emerald' | 'rose' | 'amber' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg border font-bold ${tones[tone]}`}>
      {label}: {value}
    </span>
  );
}
