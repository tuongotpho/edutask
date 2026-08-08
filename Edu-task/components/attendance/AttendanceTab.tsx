'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  ClipboardList,
  MessageSquare,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import {
  ATTENDANCE_ISSUE_LABELS,
  ATTENDANCE_STATUS_LABELS,
  AttendanceRecord,
  TIMED_ISSUES,
} from '@/Edu-task/types/attendance';
import { formatSlot } from '@/Edu-task/lib/schedule';
import {
  overview,
  punctualityRate,
  recordsInMonth,
  summariseByTeacher,
} from '@/Edu-task/lib/attendanceStats';
import { canRecordAttendance, canViewAllAttendance } from '@/Edu-task/lib/permissions';
import { QuickEntryCard } from './QuickEntryCard';
import { StatusRow, rowButton } from '@/Edu-task/components/common/StatusRow';
import { attendanceRecordTone } from '@/Edu-task/lib/statusTone';

/**
 * Nề nếp.
 *
 * What each role sees differs sharply, and on purpose. A supervisor gets the
 * entry form first. A teacher gets only records about themselves, with a reply
 * box. Leadership gets the monthly roll-up they need for thi đua. Showing
 * everyone the same screen would either expose colleagues' records to people
 * with no business seeing them, or bury the supervisor's one daily action.
 */

type SubView = 'entry' | 'records' | 'summary';

export function AttendanceTab() {
  const {
    currentUser, activeRole, attendance, users,
    submitExplanation, reviewAttendanceRecord, deleteAttendanceRecord, showToast,
  } = useApp();

  const canRecord = canRecordAttendance(currentUser, activeRole);
  const canReview = canViewAllAttendance(currentUser, activeRole);

  const [subView, setSubView] = useState<SubView>(canRecord ? 'entry' : 'records');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanationText, setExplanationText] = useState('');

  const monthRecords = useMemo(() => recordsInMonth(attendance, month), [attendance, month]);
  const stats = useMemo(() => overview(monthRecords), [monthRecords]);
  const perTeacher = useMemo(() => summariseByTeacher(monthRecords), [monthRecords]);

  const teachingStaffCount = useMemo(
    () => users.filter(u => u.status === 'ACTIVE' && u.isTeachingStaff).length,
    [users]
  );
  const punctuality = useMemo(
    () => punctualityRate(monthRecords, teachingStaffCount),
    [monthRecords, teachingStaffCount]
  );

  const tabs: Array<{ id: SubView; label: string; icon: typeof Zap; show: boolean }> = [
    { id: 'entry', label: 'Ghi Nhận Nhanh', icon: Zap, show: canRecord },
    { id: 'records', label: canReview ? 'Danh Sách Ghi Nhận' : 'Ghi Nhận Về Tôi', icon: ClipboardList, show: true },
    { id: 'summary', label: 'Tổng Hợp Tháng', icon: BarChart3, show: canReview },
  ];

  const handleExplain = async (id: string) => {
    if (await submitExplanation(id, explanationText)) {
      showToast('success', 'Đã gửi giải trình.');
      setExplainingId(null);
      setExplanationText('');
    }
  };

  return (
    <div className="space-y-5">

      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Nề Nếp Chuyên Môn</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Giám thị ghi nhận giáo viên vào lớp muộn hoặc lớp trống giờ. Giáo viên xem được bản ghi
          về mình và gửi giải trình; Ban Giám Hiệu kết luận.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.filter(t => t.show).map(tab => {
            const Icon = tab.icon;
            const isActive = subView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubView(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {subView === 'entry' && canRecord && <QuickEntryCard />}

      {subView === 'records' && (
        <section className="space-y-3">
          {attendance.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
              <p className="text-xs text-slate-500">
                {canReview ? 'Chưa có ghi nhận nào.' : 'Không có ghi nhận nào về bạn. '}
              </p>
            </div>
          ) : (
            attendance.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                isSubject={record.teacherId === currentUser?.id}
                isRecorder={record.recordedById === currentUser?.id}
                canReview={canReview}
                isExplaining={explainingId === record.id}
                explanationText={explanationText}
                onStartExplain={() => { setExplainingId(record.id); setExplanationText(''); }}
                onCancelExplain={() => setExplainingId(null)}
                onChangeExplanation={setExplanationText}
                onSubmitExplain={() => handleExplain(record.id)}
                onReview={async (decision) => {
                  const note = window.prompt(
                    decision === 'EXCUSED' ? 'Lý do miễn (tùy chọn):' : 'Ghi chú kết luận (tùy chọn):'
                  ) ?? undefined;
                  if (await reviewAttendanceRecord(record.id, decision, note)) {
                    showToast('success', decision === 'EXCUSED' ? 'Đã miễn ghi nhận này.' : 'Đã giữ nguyên ghi nhận.');
                  }
                }}
                onDelete={async () => {
                  if (await deleteAttendanceRecord(record.id)) showToast('success', 'Đã xóa ghi nhận.');
                }}
              />
            ))
          )}
        </section>
      )}

      {subView === 'summary' && canReview && (
        <section className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">Tổng Hợp Theo Tháng</h3>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <StatTile label="Lượt ghi nhận" value={stats.countedRecords} tone="amber" />
              <StatTile label="Vào lớp muộn" value={stats.lateCount} tone="rose" />
              <StatTile label="Lớp trống giờ" value={stats.emptyClassCount} tone="rose" />
              <StatTile
                label="GV không bị ghi nhận"
                value={punctuality === null ? '—' : `${punctuality}%`}
                tone="emerald"
              />
            </div>

            {/* The denominator matters, and claiming more than the data supports
                is how a dashboard number becomes an argument at a meeting. */}
            <p className="text-[10px] text-slate-400 mt-3">
              Tỷ lệ tính trên {teachingStaffCount} giáo viên đang hoạt động — là tỷ lệ giáo viên
              <strong> không có ghi nhận nào</strong> trong tháng, không phải tỷ lệ số tiết đúng giờ
              (hệ thống chưa có thời khóa biểu nên không tính được số tiết).
              {stats.totalMinutes > 0 && ` Tổng số phút muộn: ${stats.totalMinutes}.`}
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Theo Giáo Viên</h3>
            </div>
            {perTeacher.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">
                Tháng này chưa có ghi nhận nào được quy cho giáo viên cụ thể.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left font-bold text-slate-700">Giáo viên</th>
                      <th className="p-3 text-left font-bold text-slate-700">Tổ</th>
                      <th className="p-3 text-center font-bold text-slate-700">Muộn</th>
                      <th className="p-3 text-center font-bold text-slate-700">Trống giờ</th>
                      <th className="p-3 text-center font-bold text-slate-700">Ra sớm</th>
                      <th className="p-3 text-center font-bold text-slate-700">Tổng</th>
                      <th className="p-3 text-center font-bold text-slate-700">Phút</th>
                      <th className="p-3 text-center font-bold text-slate-700">Được miễn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perTeacher.map(row => (
                      <tr key={row.teacherId} className="border-t border-slate-100">
                        <td className="p-3 font-bold text-slate-800">{row.teacherName}</td>
                        <td className="p-3 text-slate-500">{row.departmentName}</td>
                        <td className="p-3 text-center">{row.lateCount || '—'}</td>
                        <td className="p-3 text-center">{row.emptyClassCount || '—'}</td>
                        <td className="p-3 text-center">{row.leftEarlyCount || '—'}</td>
                        <td className="p-3 text-center font-bold text-rose-700">{row.totalCounted}</td>
                        <td className="p-3 text-center">{row.totalMinutes || '—'}</td>
                        <td className="p-3 text-center text-emerald-700">{row.excusedCount || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function StatTile({
  label, value, tone,
}: {
  label: string;
  value: number | string;
  tone: 'amber' | 'rose' | 'emerald';
}) {
  const tones = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return (
    <div className={`p-3 rounded-2xl border ${tones[tone]}`}>
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[10px] font-semibold opacity-80 mt-0.5">{label}</div>
    </div>
  );
}

function RecordCard({
  record, isSubject, isRecorder, canReview,
  isExplaining, explanationText,
  onStartExplain, onCancelExplain, onChangeExplanation, onSubmitExplain,
  onReview, onDelete,
}: {
  record: AttendanceRecord;
  isSubject: boolean;
  isRecorder: boolean;
  canReview: boolean;
  isExplaining: boolean;
  explanationText: string;
  onStartExplain: () => void;
  onCancelExplain: () => void;
  onChangeExplanation: (text: string) => void;
  onSubmitExplain: () => void;
  onReview: (decision: 'EXCUSED' | 'CONFIRMED') => void;
  onDelete: () => void;
}) {
  const statusConfig = ATTENDANCE_STATUS_LABELS[record.status];
  const settled = record.status === 'EXCUSED' || record.status === 'CONFIRMED';

  return (
    <StatusRow
      tone={attendanceRecordTone(record.status)}
      statusLabel={statusConfig.label}
      // Anchored on the teacher the record is ABOUT, not whoever wrote it —
      // that is who the reader is looking for when scanning this list.
      personName={record.teacherName ?? '?'}
      title={
        ATTENDANCE_ISSUE_LABELS[record.issue] +
        (TIMED_ISSUES.includes(record.issue) && record.minutes ? ` ${record.minutes} phút` : '')
      }
      titleMeta={record.teacherName ?? 'Chưa xác định giáo viên'}
      trailing={record.code}
      detail={
        <>
          {formatSlot(record.slot)} · Lớp {record.className}
          <span className="block text-slate-500 mt-0.5">
            {record.departmentName ? `${record.departmentName} · ` : ''}
            ghi bởi {record.recordedByName}
          </span>
          {record.note && <span className="block text-slate-600 mt-0.5 italic">“{record.note}”</span>}
        </>
      }
      actions={
        !isExplaining ? (
          <>
            {isSubject && !settled && !record.explanation && (
              <button type="button" onClick={onStartExplain} className={rowButton.primary}>
                <MessageSquare className="w-3.5 h-3.5" /> Gửi Giải Trình
              </button>
            )}
            {canReview && !settled && (
              <>
                <button type="button" onClick={() => onReview('EXCUSED')} className={rowButton.success}>
                  <Check className="w-3.5 h-3.5" /> Miễn
                </button>
                <button type="button" onClick={() => onReview('CONFIRMED')} className={rowButton.danger}>
                  <X className="w-3.5 h-3.5" /> Giữ nguyên
                </button>
              </>
            )}
            {isRecorder && (
              <button type="button" onClick={onDelete} className={rowButton.secondary}>
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {record.explanation && (
        <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100">
          <span className="block text-[10px] font-bold text-sky-700 uppercase tracking-wide">Giải trình</span>
          <p className="text-[11px] text-slate-700 mt-0.5">{record.explanation.text}</p>
        </div>
      )}

      {settled && record.reviewNote && (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide">
            Kết luận — {record.reviewedByName}
          </span>
          <p className="text-[11px] text-slate-700 mt-0.5">{record.reviewNote}</p>
        </div>
      )}

      {isExplaining && (
        <div className="space-y-2">
          <textarea
            value={explanationText}
            onChange={e => onChangeExplanation(e.target.value)}
            rows={3}
            placeholder="Trình bày lý do…"
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancelExplain} className={rowButton.secondary}>Hủy</button>
            <button type="button" onClick={onSubmitExplain} className={rowButton.primary}>
              <Check className="w-3.5 h-3.5" /> Gửi Giải Trình
            </button>
          </div>
        </div>
      )}
    </StatusRow>
  );
}

