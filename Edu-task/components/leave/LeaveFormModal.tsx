'use client';

import React, { useState } from 'react';
import { useApp } from '@/Edu-task/context/AppContext';
import { LeaveRequest, LeaveType, LeaveSession, LEAVE_TYPE_LABELS, LEAVE_SESSION_LABELS } from '@/Edu-task/types/leave';
import { X, AlertTriangle, FileText, Info } from 'lucide-react';
import { genId } from '@/Edu-task/lib/utils';
import { useAttachmentDraft } from '@/Edu-task/hooks/useAttachmentDraft';
import { FileAttachments } from '@/Edu-task/components/common/FileAttachments';

interface LeaveFormModalProps {
  isOpen: boolean;
  editingLeave?: LeaveRequest | null;
  onClose: () => void;
}

export function LeaveFormModal({ isOpen, editingLeave, onClose }: LeaveFormModalProps) {
  const { currentUser, createLeaveRequest, updateLeaveRequest, getTeacherLeaveConflict, showToast } = useApp();

  // Seeded once per mount. The caller mounts this modal only while it is open
  // and keys it by the request being edited, so a fresh open always starts from
  // the right values — no state-syncing effect needed.
  const today = new Date().toISOString().split('T')[0];
  const [leaveType, setLeaveType] = useState<LeaveType>(editingLeave?.leaveType ?? 'PAID');
  const [startDate, setStartDate] = useState(editingLeave?.startDate ?? today);
  const [endDate, setEndDate] = useState(editingLeave?.endDate ?? today);
  const [session, setSession] = useState<LeaveSession>(editingLeave?.session ?? 'FULL_DAY');
  const [reason, setReason] = useState(editingLeave?.reason ?? '');
  // Carried through unchanged: the form has no notes field, but an existing
  // request may already have notes set by an approver.
  const notes = editingLeave?.notes ?? '';
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A brand-new request has no id yet, but attachments need one for their
  // storage path. Mint it here (stable for this mount) and hand it to
  // createLeaveRequest so the uploaded files and the document agree.
  const [draftLeaveId] = useState(() => editingLeave?.id ?? genId('LV_2026'));

  const attachments = useAttachmentDraft({
    scope: 'leaves',
    recordId: draftLeaveId,
    uploader: { id: currentUser?.id ?? '', name: currentUser?.fullName ?? '' },
    initialFiles: editingLeave?.proofFiles ?? [],
  });

  const handleClose = async () => {
    // Drop anything uploaded during this session; nothing will reference it.
    await attachments.discard();
    onClose();
  };

  if (!isOpen || !currentUser) return null;

  // Check for conflicts
  const conflict = getTeacherLeaveConflict(currentUser.id, startDate, endDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast('error', 'Vui lòng điền lý do xin nghỉ.');
      return;
    }

    const payload = {
      leaveType,
      startDate,
      endDate,
      session,
      reason,
      notes: notes || undefined,
      proofFiles: attachments.files,
    };

    setIsSubmitting(true);
    try {
      // A rejected write already surfaced a toast; keep the form open so the
      // teacher does not lose what they typed.
      const ok = editingLeave
        ? await updateLeaveRequest(editingLeave.id, payload)
        : (await createLeaveRequest({ ...payload, id: draftLeaveId })) !== null;
      if (ok) {
        // Only now delete files the user removed: cancelling must not strand the
        // saved request with a dead link.
        await attachments.commit();
        onClose();
      }
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Có lỗi xảy ra khi gửi đơn xin nghỉ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[5px] max-w-2xl w-full max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {editingLeave ? `Chỉnh Sửa Đơn Xin Nghỉ (${editingLeave.code})` : 'Tạo Đơn Xin Nghỉ Mới'}
              </h3>
              <p className="text-xs text-slate-400">Gửi trình Ban Giám Hiệu & Nhóm/Tổ trưởng chuyên môn</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 text-xs">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Applicant Info Banner */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Người xin nghỉ</span>
              <span className="font-bold text-slate-900 text-sm">{currentUser.fullName}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Tổ chuyên môn</span>
              <span className="font-semibold text-slate-700">{currentUser.departmentName}</span>
            </div>
          </div>

          {/* Conflict Warning if any */}
          {conflict.hasConflict && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Cảnh báo trùng lịch nghỉ:</strong> Bạn đã có đơn xin nghỉ trùng khoảng thời gian từ {conflict.conflictDetail?.startDate} đến {conflict.conflictDetail?.endDate}.
              </div>
            </div>
          )}

          {/* Leave Type Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">Loại hình xin nghỉ <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLeaveType(type)}
                  className={`p-2.5 rounded-xl border text-left font-semibold transition-all flex items-center space-x-2 ${
                    leaveType === type
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${LEAVE_TYPE_LABELS[type].bg}`} />
                  <span className="truncate">{LEAVE_TYPE_LABELS[type].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dates & Session */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Từ ngày <span className="text-rose-500">*</span></label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Đến ngày <span className="text-rose-500">*</span></label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Buổi nghỉ</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value as LeaveSession)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-900"
              >
                {(Object.keys(LEAVE_SESSION_LABELS) as LeaveSession[]).map(s => (
                  <option key={s} value={s}>{LEAVE_SESSION_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notice about Substitute Teacher Assignment */}
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start space-x-2 text-indigo-900">
            <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <span>
              Giáo viên không cần chọn người dạy thay khi làm đơn. Việc phân công giáo viên dạy thay sẽ do <strong>Nhóm trưởng / Tổ trưởng chuyên môn</strong> trực tiếp chỉ định khi phê duyệt.
            </span>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Lý do nghỉ <span className="text-rose-500">*</span></label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ghi rõ lý do xin nghỉ (Ví dụ: Đi khám chữa bệnh theo chỉ định bác sĩ, Lý do công tác sở...)"
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-900"
            />
          </div>

          <FileAttachments
            label="File minh chứng đính kèm (Giấy khám bệnh, Công văn...)"
            hint="Giấy khám bệnh, công văn, quyết định cử đi công tác…"
            files={attachments.files}
            onUpload={attachments.upload}
            onRemove={attachments.remove}
            onError={message => showToast('error', message)}
            disabled={isSubmitting}
          />

        </div>

          {/* Buttons — pinned below the scroll area so they stay reachable */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition-all"
            >
              {editingLeave ? 'Lưu & Gửi Lại Đơn Xin Nghỉ' : 'Gửi Đơn Xin Nghỉ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
