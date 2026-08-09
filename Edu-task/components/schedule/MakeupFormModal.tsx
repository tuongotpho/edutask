'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Repeat, X } from 'lucide-react';
import { useApp } from '@/Edu-task/context/AppContext';
import { MAKEUP_REASONS, MAKEUP_REASON_LABELS, MakeupClass, MakeupReason } from '@/Edu-task/types/makeup';
import { PeriodSlot } from '@/Edu-task/types/schedule';
import { sortClasses, sortRooms, toDateString } from '@/Edu-task/lib/schedule';
import { SlotPicker } from './SlotPicker';

/**
 * Đăng ký dạy bù.
 *
 * The clash check runs live as the teacher edits, not only on submit. Filling a
 * form and being refused at the end is the fastest way to make people give up
 * on a scheduling tool; showing the conflict the moment it appears lets them
 * pick a different period without losing anything they typed.
 */

interface MakeupFormModalProps {
  editing?: MakeupClass | null;
  onClose: () => void;
}

const inputClass =
  'w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export function MakeupFormModal({ editing, onClose }: MakeupFormModalProps) {
  const {
    currentUser, rooms, classes, leaves,
    createMakeup, updateMakeup, getMakeupSlotProblems, showToast,
  } = useApp();

  const today = toDateString(new Date());
  const activeClasses = useMemo(() => sortClasses(classes).filter(c => c.isActive), [classes]);
  const activeRooms = useMemo(() => sortRooms(rooms).filter(r => r.isActive), [rooms]);

  const [classId, setClassId] = useState(editing?.classId ?? '');
  const [subject, setSubject] = useState(editing?.subject ?? currentUser?.subject ?? '');
  const [missedSlot, setMissedSlot] = useState<PeriodSlot>(
    editing?.missedSlot ?? { date: today, session: 'MORNING', period: 1 }
  );
  const [reason, setReason] = useState<MakeupReason>(editing?.reason ?? 'LEAVE');
  const [reasonNote, setReasonNote] = useState(editing?.reasonNote ?? '');
  const [makeupSlot, setMakeupSlot] = useState<PeriodSlot>(
    editing?.makeupSlot ?? { date: today, session: 'AFTERNOON', period: 1 }
  );
  const [roomId, setRoomId] = useState(editing?.roomId ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Recomputed on every keystroke so the warning tracks what is on screen.
  const problems = useMemo(() => {
    if (!currentUser) return [];
    return getMakeupSlotProblems(makeupSlot, {
      teacherId: editing?.teacherId ?? currentUser.id,
      classId: classId || undefined,
      roomId: roomId || undefined,
      excludeId: editing?.id,
    });
  }, [currentUser, editing, getMakeupSlotProblems, makeupSlot, classId, roomId]);

  /** Approved leave the teacher already has — offered as the reason, pre-linked. */
  const relatedLeave = useMemo(
    () =>
      leaves.find(
        l =>
          l.applicantId === (editing?.teacherId ?? currentUser?.id) &&
          l.overallStatus === 'APPROVED' &&
          (l.startDate ?? '') <= missedSlot.date &&
          missedSlot.date <= (l.endDate ?? '')
      ),
    [leaves, editing, currentUser, missedSlot.date]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) {
      showToast('error', 'Vui lòng chọn lớp.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        classId,
        subject: subject.trim() || undefined,
        missedSlot,
        reason,
        reasonNote: reasonNote.trim() || undefined,
        relatedLeaveId: reason === 'LEAVE' ? relatedLeave?.id : undefined,
        makeupSlot,
        roomId: roomId || undefined,
      };

      const ok = editing
        ? await updateMakeup(editing.id, payload)
        : !!(await createMakeup(payload));

      if (ok) {
        showToast('success', editing ? 'Đã cập nhật đăng ký dạy bù.' : 'Đã gửi đăng ký dạy bù, chờ tổ trưởng duyệt.');
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const blocked = problems.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[5px] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-indigo-600" />
              {editing ? 'Sửa Đăng Ký Dạy Bù' : 'Đăng Ký Dạy Bù'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ghi lại tiết đã mất và tiết sẽ dạy bù. Tổ trưởng chuyên môn duyệt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">

          {activeClasses.length === 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              Danh mục lớp đang trống. Quản trị viên cần thêm lớp trong tab <strong>Quản Trị</strong> trước.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lớp *</label>
              <select value={classId} onChange={e => setClassId(e.target.value)} className={inputClass}>
                <option value="">— Chọn lớp —</option>
                {activeClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Toán"
                className={inputClass}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-3">
            <SlotPicker
              label="Tiết bị mất"
              value={missedSlot}
              onChange={setMissedSlot}
              hint="Tiết theo thời khóa biểu mà thầy/cô đã không dạy được."
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lý do mất tiết</label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value as MakeupReason)}
                className={inputClass}
              >
                {MAKEUP_REASONS.map(r => (
                  <option key={r} value={r}>{MAKEUP_REASON_LABELS[r]}</option>
                ))}
              </select>
              {reason === 'LEAVE' && relatedLeave && (
                <p className="text-[10px] text-emerald-700 mt-1">
                  Sẽ tự gắn với đơn nghỉ <strong>{relatedLeave.code}</strong> đã duyệt.
                </p>
              )}
              {reason === 'LEAVE' && !relatedLeave && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Không tìm thấy đơn nghỉ đã duyệt cho ngày này — vẫn đăng ký được, chỉ là không gắn liên kết.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú thêm</label>
              <input
                value={reasonNote}
                onChange={e => setReasonNote(e.target.value)}
                placeholder="Tùy chọn"
                className={inputClass}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3">
            <SlotPicker
              label="Tiết dạy bù"
              value={makeupSlot}
              onChange={setMakeupSlot}
              minDate={today}
              hint="Hệ thống tự kiểm tra trùng lịch giáo viên, lớp và phòng."
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phòng (nếu cần)</label>
              <select value={roomId} onChange={e => setRoomId(e.target.value)} className={inputClass}>
                <option value="">— Dạy tại lớp —</option>
                {activeRooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {blocked && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 space-y-1.5">
              <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Tiết dạy bù đang bị trùng
              </p>
              <ul className="space-y-1">
                {problems.map((problem, index) => (
                  <li key={index} className="text-[11px] text-rose-700">• {problem}</li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSaving || blocked || !classId}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Đang gửi…' : editing ? 'Lưu Thay Đổi' : 'Gửi Đăng Ký'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
